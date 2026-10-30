# ─────────────────────────────────────────────────────────────
# Flutter core — keep all Flutter engine classes intact
# ─────────────────────────────────────────────────────────────
-keep class io.flutter.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ─────────────────────────────────────────────────────────────
# App package
# ─────────────────────────────────────────────────────────────
-keep class io.carcomfort.** { *; }

# ─────────────────────────────────────────────────────────────
# Firebase / Google Services (FlutterFire)
# ─────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─────────────────────────────────────────────────────────────
# Mapbox Navigation & Maps SDK
# ─────────────────────────────────────────────────────────────
-keep class com.mapbox.** { *; }
-dontwarn com.mapbox.**

# ─────────────────────────────────────────────────────────────
# Kotlin & coroutines
# ─────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# ─────────────────────────────────────────────────────────────
# OkHttp / Retrofit (common Flutter plugin deps)
# ─────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class okhttp3.** { *; }
-keep class retrofit2.** { *; }

# ─────────────────────────────────────────────────────────────
# Gson / JSON serialisation (reflection-based)
# ─────────────────────────────────────────────────────────────
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ─────────────────────────────────────────────────────────────
# AndroidX & Material
# ─────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**
-keep class com.google.android.material.** { *; }

# ─────────────────────────────────────────────────────────────
# Kotlin Metadata — required for reflection & serialisation
# ─────────────────────────────────────────────────────────────
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Lazy {
    <fields>;
    <methods>;
}

# ─────────────────────────────────────────────────────────────
# Mapbox — extended rules for NavigationCore NDK27 internals
# ─────────────────────────────────────────────────────────────
-keep class com.mapbox.navigation.** { *; }
-keep class com.mapbox.maps.** { *; }
-keep class com.mapbox.bindgen.** { *; }
-keep class com.mapbox.common.** { *; }
-keep class com.mapbox.geojson.** { *; }
-keep class com.mapbox.turf.** { *; }
-keepclassmembers class com.mapbox.** {
    @com.mapbox.annotation.** <methods>;
    @com.mapbox.annotation.** <fields>;
}

# ─────────────────────────────────────────────────────────────
# OkHttp internal platform detection (reflection)
# ─────────────────────────────────────────────────────────────
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn okhttp3.internal.platform.**
-keep class okhttp3.internal.platform.** { *; }

# ─────────────────────────────────────────────────────────────
# Parcelable — keep CREATOR fields (Android serialisation)
# ─────────────────────────────────────────────────────────────
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ─────────────────────────────────────────────────────────────
# Enum — keep values()/valueOf() (often used by Mapbox/Firebase)
# ─────────────────────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ─────────────────────────────────────────────────────────────
# Native methods
# ─────────────────────────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ─────────────────────────────────────────────────────────────
# Suppress common harmless warnings from transitive deps
# ─────────────────────────────────────────────────────────────
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn javax.annotation.**
-dontwarn sun.misc.Unsafe
-dontwarn com.mapbox.annotation.**
-dontwarn okhttp3.internal.platform.**

# ─────────────────────────────────────────────────────────────────────────────
# Google Play Core — Flutter deferred components reference these at compile
# time even when the app doesn't use split installs. Suppress missing-class
# errors so R8 doesn't fail the build.
# ─────────────────────────────────────────────────────────────────────────────
-dontwarn com.google.android.play.core.splitcompat.SplitCompatApplication
-dontwarn com.google.android.play.core.splitinstall.**
-dontwarn com.google.android.play.core.tasks.**
-keep class com.google.android.play.core.splitcompat.** { *; }
-keep class com.google.android.play.core.splitinstall.** { *; }
-keep class com.google.android.play.core.tasks.** { *; }

# ─────────────────────────────────────────────────────────────
# Firebase Crashlytics
# ─────────────────────────────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
-keep class com.google.firebase.crashlytics.** { *; }
-dontwarn com.google.firebase.crashlytics.**
