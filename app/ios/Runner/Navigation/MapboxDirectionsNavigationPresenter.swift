import AVFoundation
import CoreLocation
import Flutter
import MapKit
import UIKit

/// In-app navigation using Mapbox Directions API (HTTP) + MapKit — avoids MapboxMaps v10 CocoaPods conflict.
final class MapboxDirectionsNavigationPresenter: NSObject {
  static let shared = MapboxDirectionsNavigationPresenter()

  private var presentedController: MapboxDirectionsNavigationViewController?

  func present(accessToken: String, waypoints: [NavigationWaypoint]) -> Bool {
    guard let host = flutterHostViewController() else { return false }

    dismissIfPresented(animated: false)

    let controller = MapboxDirectionsNavigationViewController(
      accessToken: accessToken,
      waypoints: waypoints
    )
    controller.modalPresentationStyle = .fullScreen
    controller.onDismiss = { [weak self] dismissed in
      if self?.presentedController === dismissed {
        self?.presentedController = nil
      }
    }
    presentedController = controller
    host.present(controller, animated: true)
    return true
  }

  func dismissIfPresented(animated: Bool = true) {
    presentedController?.dismiss(animated: animated)
    presentedController = nil
  }

  private func flutterHostViewController() -> FlutterViewController? {
    let scenes = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter {
        $0.activationState == .foregroundActive ||
          $0.activationState == .foregroundInactive
      }

    for scene in scenes {
      for window in scene.windows {
        if let flutter = findFlutterViewController(from: window.rootViewController) {
          return flutter
        }
      }
    }
    return nil
  }

  private func findFlutterViewController(from controller: UIViewController?) -> FlutterViewController? {
    guard let controller else { return nil }
    if let flutter = controller as? FlutterViewController {
      return flutter
    }
    for child in controller.children {
      if let match = findFlutterViewController(from: child) {
        return match
      }
    }
    if let presented = controller.presentedViewController {
      if presented is MapboxDirectionsNavigationViewController {
        return controller as? FlutterViewController ?? findFlutterViewController(from: controller)
      }
      if let match = findFlutterViewController(from: presented) {
        return match
      }
    }
    return nil
  }
}

/// Keeps AVSpeechSynthesizer + delegate alive and routes TTS through the loudspeaker.
private final class DriverNavigationSpeechController: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private var isMuted = false

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func setMuted(_ muted: Bool) {
    isMuted = muted
    if muted {
      synthesizer.stopSpeaking(at: .immediate)
    }
  }

  func speak(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !isMuted, !trimmed.isEmpty else { return }

    activateAudioSessionForNavigation()

    let utterance = AVSpeechUtterance(string: trimmed)
    utterance.voice = Self.preferredVoice()
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    utterance.volume = 1.0
    utterance.preUtteranceDelay = 0.05
    utterance.postUtteranceDelay = 0.05

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if self.synthesizer.isSpeaking {
        self.synthesizer.stopSpeaking(at: .word)
      }
      self.synthesizer.speak(utterance)
    }
  }

  func stop() {
    synthesizer.stopSpeaking(at: .immediate)
  }

  func prepareAudioSession() {
    activateAudioSessionForNavigation()
  }

  private static func preferredVoice() -> AVSpeechSynthesisVoice? {
    var candidates = [Locale.current.identifier]
    if let code = Locale.current.language.languageCode?.identifier {
      candidates.append(code)
    }
    candidates.append(contentsOf: ["en-US", "en-GB"])

    for code in candidates {
      if let voice = AVSpeechSynthesisVoice(language: code) {
        return voice
      }
    }
    return AVSpeechSynthesisVoice.speechVoices().first
  }

  private func activateAudioSessionForNavigation() {
    let session = AVAudioSession.sharedInstance()
    do {
      if #available(iOS 17.0, *) {
        try session.setCategory(
          .playback,
          mode: .voicePrompt,
          options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
        )
      } else {
        // iOS 16: voicePrompt/spokenAudio modes are unavailable — use playAndRecord + speaker.
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [.defaultToSpeaker, .duckOthers, .allowBluetooth]
        )
      }
      try session.setActive(true, options: .notifyOthersOnDeactivation)
      try session.overrideOutputAudioPort(.speaker)
    } catch {
      NSLog("Driver navigation audio session error: \(error.localizedDescription)")
      do {
        try session.setCategory(.playback, options: [.duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
      } catch {
        NSLog("Driver navigation audio session fallback failed: \(error.localizedDescription)")
      }
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {}

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didFail utterance: AVSpeechUtterance,
    error: Error
  ) {
    NSLog("Driver navigation speech failed: \(error.localizedDescription)")
  }
}

final class MapboxDirectionsNavigationViewController: UIViewController,
  CLLocationManagerDelegate {
  var onDismiss: ((MapboxDirectionsNavigationViewController) -> Void)?

  private let accessToken: String
  private let waypoints: [NavigationWaypoint]

  private let mapView = MKMapView()
  private let topBannerContainer = UIStackView()
  private let topBanner = UIView()
  private let maneuverIconView = UIImageView()
  private let instructionLabel = UILabel()
  private let voiceButton = UIButton(type: .system)
  private let thenBanner = UIView()
  private let thenLabel = UILabel()
  private let bottomBar = UIView()
  private let etaLabel = UILabel()
  private let detailLabel = UILabel()
  private let startButton = UIButton(type: .system)
  private let closeButton = UIButton(type: .system)
  private let recenterButton = UIButton(type: .system)
  private let locationManager = CLLocationManager()
  private let speechController = DriverNavigationSpeechController()

  private var routeSteps: [RouteStep] = []
  private var voiceCues: [VoiceCue] = []
  private var routeCoordinates: [CLLocationCoordinate2D] = []
  private var currentStepIndex = 0
  private var spokenCueIndices = Set<Int>()
  private var totalRouteDistanceMeters: Double = 0
  private var totalRouteDurationSeconds: Double = 0
  private var isFollowingUser = true
  private var isVoiceMuted = false
  private var hasAnnouncedNavigationStart = false
  private var hasStartedNavigation = false
  private var lastPuckCourse: CLLocationDirection = -1
  private let userLocationPuckReuseId = "DriverNavigationUserPuck"

  init(accessToken: String, waypoints: [NavigationWaypoint]) {
    self.accessToken = accessToken
    self.waypoints = waypoints
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    setupMap()
    setupTopBanner()
    setupBottomBar()
    setupRecenterButton()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    locationManager.requestWhenInUseAuthorization()
    locationManager.startUpdatingLocation()
    if CLLocationManager.headingAvailable() {
      locationManager.startUpdatingHeading()
    }
    fetchRoute()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    speechController.prepareAudioSession()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    if isBeingDismissed || presentingViewController == nil {
      onDismiss?(self)
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    locationManager.stopUpdatingLocation()
    locationManager.stopUpdatingHeading()
    speechController.stop()
  }

  private func setupMap() {
    mapView.translatesAutoresizingMaskIntoConstraints = false
    mapView.delegate = self
    mapView.showsUserLocation = true
    mapView.userTrackingMode = .followWithHeading
    view.addSubview(mapView)
    NSLayoutConstraint.activate([
      mapView.topAnchor.constraint(equalTo: view.topAnchor),
      mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }

  private func setupTopBanner() {
    let bannerColor = UIColor(red: 0.10, green: 0.45, blue: 0.42, alpha: 0.95)

    topBannerContainer.translatesAutoresizingMaskIntoConstraints = false
    topBannerContainer.axis = .vertical
    topBannerContainer.spacing = 6
    view.addSubview(topBannerContainer)

    topBanner.translatesAutoresizingMaskIntoConstraints = false
    topBanner.backgroundColor = bannerColor
    topBanner.layer.cornerRadius = 12
    topBanner.layer.masksToBounds = true
    topBannerContainer.addArrangedSubview(topBanner)

    maneuverIconView.translatesAutoresizingMaskIntoConstraints = false
    maneuverIconView.tintColor = .white
    maneuverIconView.contentMode = .scaleAspectFit
    maneuverIconView.image = UIImage(systemName: "arrow.up")
    maneuverIconView.setContentHuggingPriority(.required, for: .horizontal)

    instructionLabel.translatesAutoresizingMaskIntoConstraints = false
    instructionLabel.numberOfLines = 2
    instructionLabel.font = .systemFont(ofSize: 22, weight: .bold)
    instructionLabel.textColor = .white
    instructionLabel.text = "Loading route…"

    voiceButton.translatesAutoresizingMaskIntoConstraints = false
    voiceButton.tintColor = .white
    voiceButton.setImage(UIImage(systemName: "speaker.wave.2.fill"), for: .normal)
    voiceButton.addTarget(self, action: #selector(voiceTapped), for: .touchUpInside)
    voiceButton.setContentHuggingPriority(.required, for: .horizontal)

    let primaryRow = UIStackView(arrangedSubviews: [maneuverIconView, instructionLabel, voiceButton])
    primaryRow.translatesAutoresizingMaskIntoConstraints = false
    primaryRow.axis = .horizontal
    primaryRow.alignment = .center
    primaryRow.spacing = 12
    topBanner.addSubview(primaryRow)

    thenBanner.translatesAutoresizingMaskIntoConstraints = false
    thenBanner.backgroundColor = bannerColor
    thenBanner.layer.cornerRadius = 10
    thenBanner.layer.masksToBounds = true
    thenBanner.isHidden = true
    topBannerContainer.addArrangedSubview(thenBanner)

    let thenPrefix = UILabel()
    thenPrefix.translatesAutoresizingMaskIntoConstraints = false
    thenPrefix.text = "Then"
    thenPrefix.font = .systemFont(ofSize: 13, weight: .bold)
    thenPrefix.textColor = UIColor.white.withAlphaComponent(0.8)

    let thenIcon = UIImageView(image: UIImage(systemName: "arrow.turn.up.right"))
    thenIcon.translatesAutoresizingMaskIntoConstraints = false
    thenIcon.tintColor = .white
    thenIcon.contentMode = .scaleAspectFit

    thenLabel.translatesAutoresizingMaskIntoConstraints = false
    thenLabel.font = .systemFont(ofSize: 15, weight: .bold)
    thenLabel.textColor = .white
    thenLabel.numberOfLines = 1

    let thenRow = UIStackView(arrangedSubviews: [thenPrefix, thenIcon, thenLabel])
    thenRow.translatesAutoresizingMaskIntoConstraints = false
    thenRow.axis = .horizontal
    thenRow.alignment = .center
    thenRow.spacing = 8
    thenBanner.addSubview(thenRow)

    NSLayoutConstraint.activate([
      topBannerContainer.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      topBannerContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
      topBannerContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),

      primaryRow.topAnchor.constraint(equalTo: topBanner.topAnchor, constant: 12),
      primaryRow.bottomAnchor.constraint(equalTo: topBanner.bottomAnchor, constant: -12),
      primaryRow.leadingAnchor.constraint(equalTo: topBanner.leadingAnchor, constant: 14),
      primaryRow.trailingAnchor.constraint(equalTo: topBanner.trailingAnchor, constant: -10),
      maneuverIconView.widthAnchor.constraint(equalToConstant: 36),
      maneuverIconView.heightAnchor.constraint(equalToConstant: 36),
      voiceButton.widthAnchor.constraint(equalToConstant: 36),
      voiceButton.heightAnchor.constraint(equalToConstant: 36),

      thenRow.topAnchor.constraint(equalTo: thenBanner.topAnchor, constant: 8),
      thenRow.bottomAnchor.constraint(equalTo: thenBanner.bottomAnchor, constant: -8),
      thenRow.leadingAnchor.constraint(equalTo: thenBanner.leadingAnchor, constant: 12),
      thenRow.trailingAnchor.constraint(equalTo: thenBanner.trailingAnchor, constant: -12),
      thenIcon.widthAnchor.constraint(equalToConstant: 20),
      thenIcon.heightAnchor.constraint(equalToConstant: 20),
    ])
  }

  private func setupBottomBar() {
    bottomBar.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.backgroundColor = .white
    bottomBar.layer.cornerRadius = 20
    bottomBar.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    bottomBar.layer.masksToBounds = true
    bottomBar.layer.shadowColor = UIColor.black.cgColor
    bottomBar.layer.shadowOpacity = 0.12
    bottomBar.layer.shadowRadius = 8
    bottomBar.layer.shadowOffset = CGSize(width: 0, height: -2)
    view.addSubview(bottomBar)

    closeButton.translatesAutoresizingMaskIntoConstraints = false
    closeButton.setImage(UIImage(systemName: "xmark"), for: .normal)
    closeButton.tintColor = .darkGray
    closeButton.backgroundColor = UIColor(white: 0.95, alpha: 1)
    closeButton.layer.cornerRadius = 24
    closeButton.layer.shadowColor = UIColor.black.cgColor
    closeButton.layer.shadowOpacity = 0.08
    closeButton.layer.shadowRadius = 4
    closeButton.layer.shadowOffset = CGSize(width: 0, height: 1)
    closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
    bottomBar.addSubview(closeButton)

    etaLabel.translatesAutoresizingMaskIntoConstraints = false
    etaLabel.font = .systemFont(ofSize: 28, weight: .bold)
    etaLabel.textColor = UIColor(red: 0.92, green: 0.45, blue: 0.05, alpha: 1)
    etaLabel.text = "-- min"
    bottomBar.addSubview(etaLabel)

    detailLabel.translatesAutoresizingMaskIntoConstraints = false
    detailLabel.font = .systemFont(ofSize: 14, weight: .medium)
    detailLabel.textColor = .darkGray
    detailLabel.text = "Calculating route…"
    bottomBar.addSubview(detailLabel)

    startButton.translatesAutoresizingMaskIntoConstraints = false
    startButton.setTitle("Go", for: .normal)
    startButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .bold)
    startButton.setTitleColor(.white, for: .normal)
    startButton.backgroundColor = UIColor(red: 0.10, green: 0.45, blue: 0.42, alpha: 1)
    startButton.layer.cornerRadius = 24
    startButton.isHidden = true
    startButton.addTarget(self, action: #selector(startNavigationTapped), for: .touchUpInside)
    bottomBar.addSubview(startButton)

    NSLayoutConstraint.activate([
      bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      bottomBar.heightAnchor.constraint(greaterThanOrEqualToConstant: 96),
      closeButton.leadingAnchor.constraint(equalTo: bottomBar.leadingAnchor, constant: 16),
      closeButton.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 16),
      closeButton.widthAnchor.constraint(equalToConstant: 48),
      closeButton.heightAnchor.constraint(equalToConstant: 48),
      closeButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
      etaLabel.centerXAnchor.constraint(equalTo: bottomBar.centerXAnchor),
      etaLabel.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 12),
      detailLabel.centerXAnchor.constraint(equalTo: bottomBar.centerXAnchor),
      detailLabel.topAnchor.constraint(equalTo: etaLabel.bottomAnchor, constant: 2),
      detailLabel.bottomAnchor.constraint(equalTo: closeButton.bottomAnchor),
      startButton.trailingAnchor.constraint(equalTo: bottomBar.trailingAnchor, constant: -16),
      startButton.centerYAnchor.constraint(equalTo: closeButton.centerYAnchor),
      startButton.widthAnchor.constraint(equalToConstant: 88),
      startButton.heightAnchor.constraint(equalToConstant: 48),
    ])
  }

  @objc private func startNavigationTapped() {
    guard !routeCoordinates.isEmpty else { return }
    hasStartedNavigation = true
    startButton.isHidden = true
    isFollowingUser = true
    mapView.userTrackingMode = .followWithHeading
    recenterButton.isHidden = true
    announceNavigationStart()
    if let location = mapView.userLocation.location {
      advanceStepIfNeeded(for: location)
      handleVoiceCues(for: location)
    }
  }

  private func setupRecenterButton() {
    recenterButton.translatesAutoresizingMaskIntoConstraints = false
    recenterButton.setTitle("  Re-centre", for: .normal)
    recenterButton.setImage(UIImage(systemName: "location.north.line.fill"), for: .normal)
    recenterButton.tintColor = UIColor(red: 0.10, green: 0.45, blue: 0.42, alpha: 1)
    recenterButton.setTitleColor(UIColor(red: 0.10, green: 0.45, blue: 0.42, alpha: 1), for: .normal)
    recenterButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
    recenterButton.backgroundColor = .white
    recenterButton.layer.cornerRadius = 22
    recenterButton.layer.borderWidth = 1
    recenterButton.layer.borderColor = UIColor(red: 0.10, green: 0.45, blue: 0.42, alpha: 0.35).cgColor
    recenterButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 16)
    recenterButton.isHidden = true
    recenterButton.addTarget(self, action: #selector(recenterTapped), for: .touchUpInside)
    view.addSubview(recenterButton)
    NSLayoutConstraint.activate([
      recenterButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      recenterButton.bottomAnchor.constraint(equalTo: bottomBar.topAnchor, constant: -16),
    ])
  }

  @objc private func closeTapped() {
    dismiss(animated: true)
  }

  @objc private func recenterTapped() {
    isFollowingUser = true
    mapView.userTrackingMode = .followWithHeading
    recenterButton.isHidden = true
  }

  @objc private func voiceTapped() {
    isVoiceMuted.toggle()
    speechController.setMuted(isVoiceMuted)
    let symbol = isVoiceMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"
    voiceButton.setImage(UIImage(systemName: symbol), for: .normal)
  }

  private func fetchRoute() {
    let coords = waypoints
      .map { "\($0.longitude),\($0.latitude)" }
      .joined(separator: ";")
    var components = URLComponents(
      string: "https://api.mapbox.com/directions/v5/mapbox/driving-traffic/\(coords)"
    )!
    let languageCode = Locale.current.language.languageCode?.identifier ?? "en"
    components.queryItems = [
      URLQueryItem(name: "access_token", value: accessToken),
      URLQueryItem(name: "geometries", value: "geojson"),
      URLQueryItem(name: "steps", value: "true"),
      URLQueryItem(name: "voice_instructions", value: "true"),
      URLQueryItem(name: "banner_instructions", value: "true"),
      URLQueryItem(name: "language", value: languageCode),
      URLQueryItem(name: "voice_units", value: "imperial"),
      URLQueryItem(name: "overview", value: "full"),
    ]

    guard let url = components.url else {
      instructionLabel.text = "Could not build route request"
      return
    }

    URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
      guard let self else { return }
      if error != nil {
        DispatchQueue.main.async { self.instructionLabel.text = "Route request failed" }
        return
      }
      guard let data,
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        DispatchQueue.main.async { self.instructionLabel.text = "No route found" }
        return
      }
      if let message = json["message"] as? String, !message.isEmpty {
        DispatchQueue.main.async { self.instructionLabel.text = message }
        return
      }
      guard let routes = json["routes"] as? [[String: Any]],
            let first = routes.first,
            let geometry = first["geometry"] as? [String: Any],
            let coordinates = geometry["coordinates"] as? [[Double]] else {
        DispatchQueue.main.async { self.instructionLabel.text = "No route found" }
        return
      }

      let steps = self.parseSteps(from: first)
      let cues = self.parseVoiceCues(from: first)
      let path = coordinates.compactMap { pair -> CLLocationCoordinate2D? in
        guard pair.count >= 2 else { return nil }
        return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
      }
      let distance = (first["distance"] as? NSNumber)?.doubleValue ?? 0
      let duration = (first["duration"] as? NSNumber)?.doubleValue ?? 0

      DispatchQueue.main.async {
        self.routeSteps = steps
        self.voiceCues = cues
        self.spokenCueIndices.removeAll()
        self.currentStepIndex = 0
        self.routeCoordinates = path
        self.totalRouteDistanceMeters = distance
        self.totalRouteDurationSeconds = duration
        if let firstStep = steps.first {
          self.updateDirectionBanner(for: firstStep, next: steps.dropFirst().first)
        }
        self.updateTripProgress(for: self.mapView.userLocation.location)
        self.drawRoute(path)
        self.startButton.isHidden = false
        self.instructionLabel.text = "Route ready — tap Go to start"
      }
    }.resume()
  }

  private func parseSteps(from route: [String: Any]) -> [RouteStep] {
    guard let legs = route["legs"] as? [[String: Any]] else { return [] }
    var result: [RouteStep] = []
    for leg in legs {
      guard let steps = leg["steps"] as? [[String: Any]] else { continue }
      for step in steps {
        let maneuver = step["maneuver"] as? [String: Any]
        let instruction = (maneuver?["instruction"] as? String)
          ?? (step["name"] as? String)
          ?? "Continue"
        let loc = maneuver?["location"] as? [Double]
        let coordinate: CLLocationCoordinate2D?
        if let loc, loc.count >= 2 {
          coordinate = CLLocationCoordinate2D(latitude: loc[1], longitude: loc[0])
        } else {
          coordinate = nil
        }
        let voiceText = self.firstVoiceAnnouncement(from: step) ?? instruction
        let modifier = (maneuver?["modifier"] as? String) ?? ""
        let type = (maneuver?["type"] as? String) ?? ""
        result.append(
          RouteStep(
            instruction: instruction,
            voiceText: voiceText,
            coordinate: coordinate,
            maneuverType: type,
            maneuverModifier: modifier
          )
        )
      }
    }
    return result
  }

  private func voiceInstructions(from step: [String: Any]) -> [[String: Any]] {
    if let camel = step["voiceInstructions"] as? [[String: Any]] {
      return camel
    }
    if let snake = step["voice_instructions"] as? [[String: Any]] {
      return snake
    }
    return []
  }

  private func voiceAnnouncement(from voice: [String: Any]) -> String? {
    if let announcement = voice["announcement"] as? String, !announcement.isEmpty {
      return announcement
    }
    if let announcement = voice["ssmlAnnouncement"] as? String, !announcement.isEmpty {
      return Self.plainText(fromSsml: announcement)
    }
    if let announcement = voice["ssml_announcement"] as? String, !announcement.isEmpty {
      return Self.plainText(fromSsml: announcement)
    }
    return nil
  }

  private static func plainText(fromSsml ssml: String) -> String {
    ssml
      .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
      .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func firstVoiceAnnouncement(from step: [String: Any]) -> String? {
    for voice in voiceInstructions(from: step) {
      if let announcement = voiceAnnouncement(from: voice) {
        return announcement
      }
    }
    return nil
  }

  private func parseVoiceCues(from route: [String: Any]) -> [VoiceCue] {
    guard let legs = route["legs"] as? [[String: Any]] else { return [] }
    var cues: [VoiceCue] = []
    var legOffset = 0.0
    for leg in legs {
      guard let steps = leg["steps"] as? [[String: Any]] else { continue }
      for step in steps {
        let stepDistance = (step["distance"] as? NSNumber)?.doubleValue ?? 0
        for voice in voiceInstructions(from: step) {
          let along = (voice["distanceAlongGeometry"] as? NSNumber)?.doubleValue
            ?? (voice["distance_along_geometry"] as? NSNumber)?.doubleValue
            ?? 0
          if let announcement = voiceAnnouncement(from: voice) {
            cues.append(VoiceCue(text: announcement, distanceFromStart: legOffset + along))
          }
        }
        legOffset += stepDistance
      }
    }
    return cues.sorted { $0.distanceFromStart < $1.distanceFromStart }
  }

  private func drawRoute(_ coordinates: [CLLocationCoordinate2D]) {
    guard !coordinates.isEmpty else { return }
    mapView.removeOverlays(mapView.overlays)
    let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
    mapView.addOverlay(polyline)
    mapView.setVisibleMapRect(
      polyline.boundingMapRect,
      edgePadding: UIEdgeInsets(top: 120, left: 40, bottom: 80, right: 40),
      animated: true
    )
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    updateUserPuckRotation(for: location)
    updateTripProgress(for: location)
    advanceStepIfNeeded(for: location)
    handleVoiceCues(for: location)
  }

  func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
    guard newHeading.headingAccuracy >= 0 else { return }
    let heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
    lastPuckCourse = heading
    if let view = mapView.view(for: mapView.userLocation) {
      applyPuckRotation(to: view, course: heading)
    }
  }

  private func updateUserPuckRotation(for location: CLLocation) {
    guard location.course >= 0 else { return }
    lastPuckCourse = location.course
    if let view = mapView.view(for: mapView.userLocation) {
      applyPuckRotation(to: view, course: location.course)
    }
  }

  private func applyPuckRotation(to view: MKAnnotationView, course: CLLocationDirection) {
    if isFollowingUser && mapView.userTrackingMode == .followWithHeading {
      view.transform = .identity
      return
    }
    let radians = CGFloat(course * .pi / 180)
    view.transform = CGAffineTransform(rotationAngle: radians)
  }

  private func makeNavigationPuckImage() -> UIImage? {
    let config = UIImage.SymbolConfiguration(pointSize: 30, weight: .bold)
    let arrow = UIImage(systemName: "location.north.line.fill", withConfiguration: config)?
      .withTintColor(UIColor(red: 0.16, green: 0.44, blue: 0.95, alpha: 1), renderingMode: .alwaysOriginal)
    return arrow
  }

  private func updateTripProgress(for location: CLLocation?) {
    guard totalRouteDistanceMeters > 0, totalRouteDurationSeconds > 0 else { return }
    let remaining = remainingDistanceMeters(from: location)
    let ratio = min(1, max(0, remaining / totalRouteDistanceMeters))
    let remainingSeconds = totalRouteDurationSeconds * ratio
    let minutes = max(1, Int((remainingSeconds / 60).rounded()))
    etaLabel.text = "\(minutes) min"
    let km = remaining / 1000
    let distanceText = km >= 1
      ? String(format: "%.1f km", km)
      : String(format: "%.0f m", remaining)
    let arrival = Date().addingTimeInterval(remainingSeconds)
    let formatter = DateFormatter()
    formatter.timeStyle = .short
    detailLabel.text = "\(distanceText) • \(formatter.string(from: arrival))"
  }

  private func remainingDistanceMeters(from location: CLLocation?) -> Double {
    guard let location, routeCoordinates.count >= 2 else {
      return totalRouteDistanceMeters
    }
    var closestIndex = 0
    var closestDist = Double.greatestFiniteMagnitude
    for (index, coord) in routeCoordinates.enumerated() {
      let d = location.distance(from: CLLocation(latitude: coord.latitude, longitude: coord.longitude))
      if d < closestDist {
        closestDist = d
        closestIndex = index
      }
    }
    var remaining = closestDist
    if closestIndex < routeCoordinates.count - 1 {
      for i in closestIndex..<(routeCoordinates.count - 1) {
        let a = routeCoordinates[i]
        let b = routeCoordinates[i + 1]
        remaining += CLLocation(latitude: a.latitude, longitude: a.longitude)
          .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
      }
    }
    return min(totalRouteDistanceMeters, max(0, remaining))
  }

  private func advanceStepIfNeeded(for location: CLLocation?) {
    guard hasStartedNavigation else { return }
    guard let location, currentStepIndex < routeSteps.count else { return }
    let step = routeSteps[currentStepIndex]
    let nextStep = currentStepIndex + 1 < routeSteps.count
      ? routeSteps[currentStepIndex + 1]
      : nil
    updateDirectionBanner(for: step, next: nextStep)

    if let target = step.coordinate {
      let dist = location.distance(from: CLLocation(latitude: target.latitude, longitude: target.longitude))
      if dist > 45 { return }
    }

    if hasAnnouncedNavigationStart && currentStepIndex == 0 {
      currentStepIndex += 1
      return
    }

    speak(step.voiceText)
    currentStepIndex += 1
  }

  private func announceNavigationStart() {
    hasAnnouncedNavigationStart = true
    if let firstCue = voiceCues.first {
      speak(firstCue.text)
      spokenCueIndices.insert(0)
      return
    }
    if let firstStep = routeSteps.first {
      speak(firstStep.voiceText)
    }
  }

  private func handleVoiceCues(for location: CLLocation?) {
    guard hasStartedNavigation else { return }
    guard let location, !voiceCues.isEmpty else { return }
    let traveled = max(0, totalRouteDistanceMeters - remainingDistanceMeters(from: location))
    for (index, cue) in voiceCues.enumerated() {
      if spokenCueIndices.contains(index) { continue }
      if traveled + 80 >= cue.distanceFromStart {
        speak(cue.text)
        spokenCueIndices.insert(index)
      }
    }
  }

  private func updateDirectionBanner(for step: RouteStep, next: RouteStep?) {
    instructionLabel.text = step.instruction
    maneuverIconView.image = maneuverSymbol(type: step.maneuverType, modifier: step.maneuverModifier)
    if let next, !next.instruction.isEmpty {
      thenBanner.isHidden = false
      thenLabel.text = next.instruction
    } else {
      thenBanner.isHidden = true
    }
  }

  private func maneuverSymbol(type: String, modifier: String) -> UIImage? {
    let mod = modifier.lowercased()
    let name: String
    switch mod {
    case "left", "slight left", "sharp left":
      name = "arrow.turn.up.left"
    case "right", "slight right", "sharp right":
      name = "arrow.turn.up.right"
    case "uturn":
      name = "arrow.uturn.up"
    default:
      if type.lowercased() == "arrive" {
        name = "flag.checkered"
      } else {
        name = "arrow.up"
      }
    }
    return UIImage(systemName: name)
  }

  private func speak(_ text: String) {
    guard !isVoiceMuted else { return }
    speechController.speak(text)
  }
}

extension MapboxDirectionsNavigationViewController: MKMapViewDelegate {
  func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    guard annotation is MKUserLocation else { return nil }

    let view: MKAnnotationView
    if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: userLocationPuckReuseId) {
      reused.annotation = annotation
      view = reused
    } else {
      view = MKAnnotationView(annotation: annotation, reuseIdentifier: userLocationPuckReuseId)
      view.canShowCallout = false
      view.image = makeNavigationPuckImage()
      view.centerOffset = .zero
    }

    if lastPuckCourse >= 0 {
      applyPuckRotation(to: view, course: lastPuckCourse)
    }
    return view
  }

  func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    if let polyline = overlay as? MKPolyline {
      let renderer = MKPolylineRenderer(polyline: polyline)
      renderer.strokeColor = UIColor(red: 0.16, green: 0.44, blue: 0.95, alpha: 1)
      renderer.lineWidth = 6
      return renderer
    }
    return MKOverlayRenderer(overlay: overlay)
  }

  func mapView(_ mapView: MKMapView, regionWillChangeAnimated animated: Bool) {
    if mapView.userTrackingMode == .none {
      isFollowingUser = false
      recenterButton.isHidden = false
    }
  }
}

private struct RouteStep {
  let instruction: String
  let voiceText: String
  let coordinate: CLLocationCoordinate2D?
  let maneuverType: String
  let maneuverModifier: String
}

private struct VoiceCue {
  let text: String
  let distanceFromStart: Double
}
