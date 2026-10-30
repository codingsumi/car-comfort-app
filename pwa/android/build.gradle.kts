fun readEnvValue(key: String): String {
    val localProperties = java.util.Properties()
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

val mapboxDownloadsToken = readEnvValue("MAPBOX_DOWNLOADS_TOKEN")
    .ifEmpty { readEnvValue("MAPBOX_ACCESS_TOKEN") }

allprojects {
    repositories {
        google()
        mavenCentral()
        maven(url = uri("https://www.jitpack.io"))
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

// mapbox_maps_flutter registers an unauthenticated releases repo; ensure auth wins.
gradle.projectsEvaluated {
    rootProject.allprojects {
        repositories.removeAll { repo ->
            repo is MavenArtifactRepository &&
                repo.url.toString().startsWith("https://api.mapbox.com/downloads/v2/")
        }
        if (mapboxDownloadsToken.isNotEmpty()) {
            repositories.maven {
                url = uri("https://api.mapbox.com/downloads/v2/releases/maven")
                authentication {
                    create<BasicAuthentication>("basic")
                }
                credentials {
                    username = "mapbox"
                    password = mapboxDownloadsToken
                }
            }
            repositories.maven {
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

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
