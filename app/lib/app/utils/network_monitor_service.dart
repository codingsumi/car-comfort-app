import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io' show Socket;

import 'package:connectivity_plus/connectivity_plus.dart';
import '../utils/alerts.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';

/// Service for monitoring network quality and performance
class NetworkMonitorService extends GetxService {
  static NetworkMonitorService get instance => Get.find();

  final Connectivity _connectivity = Connectivity();
  late StreamSubscription<List<ConnectivityResult>> _connectivitySubscription;

  // Observable network state
  final RxString connectionType = 'wifi'.obs;
  final RxDouble networkSpeed = 100.0.obs;
  final RxInt latency = 50.obs;

  // Network quality indicators
  final RxBool isSlowNetwork = false.obs;

  // Network connectivity state
  final RxBool isConnected = true.obs;

  Timer? _speedTestTimer;

  @override
  Future<void> onInit() async {
    super.onInit();
    await _initializeConnectivity();
    _startNetworkMonitoring();
  }

  @override
  void onClose() {
    _connectivitySubscription.cancel();
    _speedTestTimer?.cancel();
    super.onClose();
  }

  Future<void> _initializeConnectivity() async {
    try {
      final result = await _connectivity.checkConnectivity();
      _updateConnectionStatus(result);
    } on Exception catch (e) {
      if (kDebugMode) {
        log('NetworkMonitorService', 'NetworkMonitor initialization error: $e');
      }
      // Assume connected if we can't check
      isConnected.value = true;
    }
  }

  void _startNetworkMonitoring() {
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
      _updateConnectionStatus,
      onError: (error) {
        if (kDebugMode) {
          log('NetworkMonitorService', 'Connectivity stream error: $error');
        }
      },
    );

    // Periodic network speed test (every 30 seconds)
    _speedTestTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _testNetworkSpeed();
    });
  }

  void _updateConnectionStatus(List<ConnectivityResult> result) {
    // Determine connection type (assuming always connected)
    if (result.contains(ConnectivityResult.wifi)) {
      connectionType.value = 'wifi';
    } else if (result.contains(ConnectivityResult.ethernet)) {
      connectionType.value = 'ethernet';
    } else if (result.contains(ConnectivityResult.mobile)) {
      connectionType.value = 'mobile';
    } else {
      connectionType.value = 'other';
    }

    final isCurrentlyConnected = !result.contains(ConnectivityResult.none);
    isConnected.value = isCurrentlyConnected;

    // Test network speed periodically
    _testNetworkSpeed();

    if (kDebugMode) {
      log('NetworkMonitorService', '🌐 Network Type: $connectionType');
    }
  }

  Future<void> _testNetworkSpeed() async {
    try {
      final stopwatch = Stopwatch()..start();

      if (kIsWeb) {
        /*        // 🌐 Web-safe test using HTTP request
        final response = await http.get(Uri.parse('https://www.google.com'));
        stopwatch.stop();

        if (response.statusCode == 200) {
          latency.value = stopwatch.elapsedMilliseconds;
        } else {
          latency.value = 9999;
        }*/
      } else {
        // 📱 Mobile / Desktop test using raw socket (faster ping)
        final socket = await Socket.connect('8.8.8.8', 53, timeout: const Duration(seconds: 5));
        stopwatch.stop();

        latency.value = stopwatch.elapsedMilliseconds;
        socket.destroy();
      }

      _estimateNetworkSpeed();
    } catch (e) {
      if (kDebugMode) {
        developer.log('NetworkMonitorService: Network speed test failed: $e');
      }
      latency.value = 9999; // High latency → poor connection
      isSlowNetwork.value = true;
    }
  }

  void _estimateNetworkSpeed() {
    // Rough estimation based on connection type and latency
    var estimatedSpeed = 0.0;

    switch (connectionType.value) {
      case 'wifi':
        estimatedSpeed = latency.value < 50
            ? 100.0
            : latency.value < 100
            ? 50.0
            : 10.0;
        break;
      case 'ethernet':
        estimatedSpeed = latency.value < 30
            ? 1000.0
            : latency.value < 50
            ? 100.0
            : 10.0;
        break;
      case 'mobile':
        estimatedSpeed = latency.value < 100
            ? 50.0
            : latency.value < 200
            ? 10.0
            : 1.0;
        break;
      default:
        estimatedSpeed = 1.0;
    }

    networkSpeed.value = estimatedSpeed;
    isSlowNetwork.value = estimatedSpeed < 10.0 || latency.value > 500;
  }

  /// Check if network is suitable for large operations
  bool get isNetworkSuitableForLargeOperations => !isSlowNetwork.value && latency.value < 1000 && networkSpeed.value > 5.0;

  /// Get network quality description
  String get networkQualityDescription {
    if (isSlowNetwork.value) {
      return 'Slow';
    }
    if (networkSpeed.value > 50) {
      return 'Fast';
    }
    return 'Moderate';
  }

  /// Force refresh network status
  Future<void> refreshNetworkStatus() async {
    await _initializeConnectivity();
    await _testNetworkSpeed();
  }
}
