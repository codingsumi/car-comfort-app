import Flutter
import UIKit

/// Native turn-by-turn bridge (iOS uses Mapbox Directions API + MapKit — no MapboxMaps v10 pod).
final class DriverNavigationPlugin: NSObject, FlutterPlugin {
  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: "io.carcomfort.app/driver_navigation",
      binaryMessenger: registrar.messenger()
    )
    let instance = DriverNavigationPlugin()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "startNavigation":
      startNavigation(call: call, result: result)
    case "stopNavigation":
      MapboxDirectionsNavigationPresenter.shared.dismissIfPresented()
      result(true)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func startNavigation(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let args = call.arguments as? [String: Any],
          let rawWaypoints = args["waypoints"] as? [[String: Any]],
          rawWaypoints.count >= 2 else {
      result(false)
      return
    }

    let token = (args["accessToken"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
      ?? (Bundle.main.object(forInfoDictionaryKey: "MBXAccessToken") as? String)
      ?? (Bundle.main.object(forInfoDictionaryKey: "MGLMapboxAccessToken") as? String)
      ?? ""

    guard !token.isEmpty else {
      result(false)
      return
    }

    let waypoints: [NavigationWaypoint] = rawWaypoints.compactMap { item in
      guard let lat = Self.parseCoordinate(item["latitude"]),
            let lng = Self.parseCoordinate(item["longitude"]) else { return nil }
      let name = (item["name"] as? String) ?? "Stop"
      let isSilent = (item["isSilent"] as? Bool) ?? false
      return NavigationWaypoint(name: name, latitude: lat, longitude: lng, isSilent: isSilent)
    }

    guard waypoints.count >= 2 else {
      result(false)
      return
    }

    DispatchQueue.main.async {
      let started = MapboxDirectionsNavigationPresenter.shared.present(
        accessToken: token,
        waypoints: waypoints
      )
      result(started)
    }
  }

  /// Flutter method channels send numbers as NSNumber, not Swift Double.
  private static func parseCoordinate(_ value: Any?) -> Double? {
    switch value {
    case let number as NSNumber:
      return number.doubleValue
    case let double as Double:
      return double
    case let float as Float:
      return Double(float)
    case let int as Int:
      return Double(int)
    default:
      return nil
    }
  }
}

struct NavigationWaypoint {
  let name: String
  let latitude: Double
  let longitude: Double
  let isSilent: Bool
}
