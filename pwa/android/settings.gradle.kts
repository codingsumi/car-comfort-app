pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    // START: FlutterFire Configuration
    id("com.google.gms.google-services") version("4.4.2") apply false
    id("com.google.firebase.crashlytics") version("3.0.2") apply false
    // END: FlutterFire Configuration
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}

include(":app")

fun readEnvValue(key: String): String {
    val localProperties = java.util.Properties()
    val localFile = file("local.properties")
    if (localFile.exists()) {
        localFile.inputStream().use { localProperties.load(it) }
    }
    val fromLocal = localProperties.getProperty(key)?.trim().orEmpty()
    if (fromLocal.isNotEmpty()) return fromLocal

    val envFile = file("../.env")
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

val mapboxDownloadsToken = readEnvValue("MAPBOX_DOWNLOADS_TOKEN")
    .ifEmpty { readEnvValue("MAPBOX_ACCESS_TOKEN") }

if (mapboxDownloadsToken.isNotEmpty()) {
    gradle.beforeProject {
        if (findProperty("MAPBOX_DOWNLOADS_TOKEN") == null) {
            extensions.extraProperties.set(
                "MAPBOX_DOWNLOADS_TOKEN",
                mapboxDownloadsToken,
            )
        }
        if (findProperty("SDK_REGISTRY_TOKEN") == null) {
            extensions.extraProperties.set(
                "SDK_REGISTRY_TOKEN",
                mapboxDownloadsToken,
            )
        }
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        mavenCentral()
        if (mapboxDownloadsToken.isNotEmpty()) {
            maven {
                url = uri("https://api.mapbox.com/downloads/v2/releases/maven")
                authentication {
                    create<BasicAuthentication>("basic")
                }
                credentials {
                    username = "mapbox"
                    password = mapboxDownloadsToken
                }
            }
            maven {
                url = uri("https://api.mapbox.com/downloads/v2/snapshots/maven")
                authentication {
                    create<BasicAuthentication>("basic")
                }
                credentials {
                    username = "mapbox"
                    password = mapboxDownloadsToken
                }
            }
        }
    }
}
