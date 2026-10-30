import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

fun readEnvValue(key: String): String {
    val localProperties = Properties()
    val localFile = rootProject.file("local.properties")
    if (localFile.exists()) {
        localFile.inputStream().use { localProperties.load(it) }
    }
    val fromLocal = localProperties.getProperty(key)?.trim().orEmpty()
    if (fromLocal.isNotEmpty()) return fromLocal

    val envFile = rootProject.file("../.env")
    if (!envFile.exists()) return ""
    return envFile.readLines()
        .firstOrNull { line ->
            val trimmed = line.trim()
            trimmed.startsWith("$key=") && !trimmed.startsWith("#")
        }
        ?.substringAfter("=")
        ?.trim()
        .orEmpty()
}

val mapboxAccessToken = readEnvValue("MAPBOX_ACCESS_TOKEN")

android {
    namespace = "io.carcomfort.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("CM_KEYSTORE_PATH") ?: rootProject.file("../car_comfort.jks").absolutePath
            val keystorePass = System.getenv("CM_KEYSTORE_PASSWORD") ?: "1234!@#\$"
            val keyAlias = System.getenv("CM_KEY_ALIAS") ?: "key0"
            val keyPass = System.getenv("CM_KEY_PASSWORD") ?: "1234!@#\$"
            storeFile = file(keystorePath)
            storePassword = keystorePass
            this.keyAlias = keyAlias
            keyPassword = keyPass
        }
    }

    defaultConfig {
        applicationId = "io.carcomfort.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        if (mapboxAccessToken.isNotEmpty()) {
            resValue("string", "mapbox_access_token", mapboxAccessToken)
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // v3.24.3 is the matching Navigation release for Maps SDK 11.24.3 and
    // Core Common 24.24.3, which mapbox_maps_flutter 2.24.3 bundles. Mixing
    // 3.21.x with these newer native binaries crashes in libmapbox-common.so.
    val mapboxNavVersion = "3.24.3"
    implementation("com.mapbox.navigationcore:android-ndk27:$mapboxNavVersion")
    implementation("com.mapbox.navigationcore:ui-maps-ndk27:$mapboxNavVersion")
    implementation("com.mapbox.navigationcore:ui-components-ndk27:$mapboxNavVersion")
    implementation("com.mapbox.navigationcore:voice-ndk27:$mapboxNavVersion")
    implementation("com.mapbox.navigationcore:tripdata-ndk27:$mapboxNavVersion")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.9.22"))
    // Required by Flutter's PlayStoreDeferredComponentManager — referenced at compile
    // time by R8. Use compileOnly to avoid runtime duplication with core-common.
    compileOnly("com.google.android.play:feature-delivery:2.1.0")
}
