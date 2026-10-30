import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_storage/get_storage.dart';

/// Secure storage wrapper for sensitive values (JWT token, remembered password).
///
/// Uses the platform Keychain (iOS) / Keystore-backed EncryptedSharedPreferences
/// (Android) via flutter_secure_storage.
///
/// Crash recovery: Android Keystore keys can become invalid after a reinstall,
/// OS upgrade, or backup/restore. When a [BadPaddingException] / decrypt error
/// is detected we wipe the entire secure storage and start fresh — the user
/// will need to log in again, but the app will not crash on startup.
class SecurePrefs {
  SecurePrefs._();
  static final SecurePrefs _instance = SecurePrefs._();
  static SecurePrefs get instance => _instance;

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _keyToken = 'secure_user_token';
  static const _keyRememberedPassword = 'secure_remembered_password';
  static const _migrationDoneKey = 'secure_migration_v1_done';

  // Stored in GetStorage (cleared on uninstall) to detect fresh installs.
  // On iOS, Keychain survives uninstall — this flag lets us wipe it on
  // the first launch after a reinstall so the user is not auto-logged-in.
  static const _freshInstallFlagKey = 'app_installed_v1';
  static final _flagBox = GetStorage();

  // ── Keystore recovery ─────────────────────────────────────────────────────

  /// Returns true if the exception looks like an Android Keystore
  /// BAD_DECRYPT / key-invalidation error.
  static bool _isKeystoreDecryptError(Object e) {
    final msg = e.toString().toLowerCase();
    return msg.contains('badpaddingexception') ||
        msg.contains('bad_decrypt') ||
        msg.contains('bad decrypt') ||
        msg.contains('keysnotavailableexception') ||
        msg.contains('keystoreexception') ||
        msg.contains('usernotauthenticatedexception');
  }

  /// Wipe all secure storage keys so the app can start fresh.
  /// Called automatically when a decrypt error is detected.
  Future<void> _recoverFromKeystoreError(Object e) async {
    debugPrint('[SecurePrefs] Keystore decrypt error — wiping secure storage: $e');
    try {
      await _storage.deleteAll();
    } catch (_) {
      // If deleteAll also fails, delete individual keys.
      for (final k in [_keyToken, _keyRememberedPassword, _migrationDoneKey]) {
        try {
          await _storage.delete(key: k);
        } catch (_) {}
      }
    }
  }

  // ── Fresh-install Keychain wipe (iOS) ──────────────────────────────────────
  //
  // iOS does NOT clear Keychain on uninstall. This means a stale JWT from
  // a previous install can still be present after a fresh reinstall, causing
  // the app to skip the login screen entirely.
  //
  // Strategy: write a plain flag into GetStorage (which IS cleared on
  // uninstall). On every startup, before reading the token, check the flag.
  // If missing — this is a fresh install — wipe Keychain and write the flag.
  // Subsequent launches find the flag and skip the wipe.

  /// Call once at startup, before [readToken], after GetStorage.init().
  /// On iOS, wipes Keychain when no install flag is present (fresh install or
  /// reinstall). No-op on Android (Keystore is already tied to the install).
  Future<void> clearKeychainIfFreshInstall() async {
    // Guard against re-running on Flutter hot-restart.  Once this method
    // has executed for the current Dart isolate session, skip subsequent
    // calls so a debug restart does not re-wipe the Keychain.
    if (_clearKeychainChecked) return;
    _clearKeychainChecked = true;

    // Android Keystore is cleared on uninstall — no action needed.
    if (!_isIOS()) {
      _flagBox.write(_freshInstallFlagKey, true);
      return;
    }
    final alreadyInstalled = _flagBox.read<bool>(_freshInstallFlagKey) ?? false;
    if (alreadyInstalled) return;

    // Flag is absent — this is a fresh install. Wipe all Keychain entries
    // so no stale token, password, or migration marker survive from a
    // previous install.
    debugPrint('[SecurePrefs] Fresh install detected — clearing Keychain.');
    try {
      await _storage.deleteAll();
    } catch (e) {
      for (final k in [_keyToken, _keyRememberedPassword, _migrationDoneKey]) {
        try { await _storage.delete(key: k); } catch (_) {}
      }
    }
    _flagBox.write(_freshInstallFlagKey, true);
  }

  // ── One-shot fresh-install check ─────────────────────────────────────────
  //
  // This must run only once per app **session** (cold start).  On Flutter
  // hot-restart / hot-reload `main()` runs again, but we do NOT want to
  // re-evaluate the fresh-install flag because the user is still running
  // the same install — they're just getting a debug restart.
  //
  // _clearKeychainChecked acts as an in-memory guard so the logic runs
  // exactly once per Dart isolate lifecycle.
  static bool _clearKeychainChecked = false;

  static bool _isIOS() {
    // Use `defaultTargetPlatform` so it works without a BuildContext and
    // is mockable in tests.
    return defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;
  }

  // ── Token ─────────────────────────────────────────────────────────────────

  Future<void> writeToken(String token) async {
    if (token.isEmpty) {
      await _storage.delete(key: _keyToken);
      return;
    }
    await _storage.write(key: _keyToken, value: token);
  }

  Future<String> readToken() async {
    try {
      return await _storage.read(key: _keyToken) ?? '';
    } catch (e) {
      if (_isKeystoreDecryptError(e)) {
        await _recoverFromKeystoreError(e);
        return '';
      }
      rethrow;
    }
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: _keyToken);
  }

  // ── Remembered Password ───────────────────────────────────────────────────

  Future<void> writeRememberedPassword(String password) async {
    if (password.isEmpty) {
      await _storage.delete(key: _keyRememberedPassword);
      return;
    }
    await _storage.write(key: _keyRememberedPassword, value: password);
  }

  Future<String> readRememberedPassword() async {
    try {
      return await _storage.read(key: _keyRememberedPassword) ?? '';
    } catch (e) {
      if (_isKeystoreDecryptError(e)) {
        await _recoverFromKeystoreError(e);
        return '';
      }
      rethrow;
    }
  }

  Future<void> deleteRememberedPassword() async {
    await _storage.delete(key: _keyRememberedPassword);
  }

  // ── Full clear (logout) ───────────────────────────────────────────────────

  Future<void> clear() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyRememberedPassword);
  }

  // ── One-time migration from GetStorage ───────────────────────────────────
  //
  // Call once at app startup (after GetStorage.init). Reads the plain-text
  // values from GetStorage, writes them to secure storage, then deletes from
  // GetStorage so they are no longer stored in plain JSON on disk.

  Future<void> migrateFromGetStorage({
    required String? legacyToken,
    required String? legacyPassword,
    required Future<void> Function() clearLegacyToken,
    required Future<void> Function() clearLegacyPassword,
  }) async {
    String? alreadyMigrated;
    try {
      alreadyMigrated = await _storage.read(key: _migrationDoneKey);
    } catch (e) {
      if (_isKeystoreDecryptError(e)) {
        // Keystore key is bad — wipe everything and let startup continue.
        // Migration flag will be written below so we don't loop.
        await _recoverFromKeystoreError(e);
        alreadyMigrated = null;
      } else {
        rethrow;
      }
    }

    if (alreadyMigrated == '1') return;

    if (legacyToken != null && legacyToken.isNotEmpty) {
      await writeToken(legacyToken);
      await clearLegacyToken();
    }
    if (legacyPassword != null && legacyPassword.isNotEmpty) {
      await writeRememberedPassword(legacyPassword);
      await clearLegacyPassword();
    }

    await _storage.write(key: _migrationDoneKey, value: '1');
  }
}
