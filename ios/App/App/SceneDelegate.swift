import UIKit
import Capacitor
import EventKit
import EventKitUI
import CoreLocation
import MapKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CalendarBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Local plugin: the person saves the event in Apple's editor, never a share sheet.
class CalendarBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CalendarEditorPlugin())
        bridge?.registerPluginInstance(LocationGuidePlugin())
        bridge?.registerPluginInstance(HuntMapPlugin())
    }
}

@objc(CalendarEditorPlugin)
public class CalendarEditorPlugin: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate {
    public let identifier = "CalendarEditorPlugin"
    public let jsName = "CalendarEditor"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]
    private let store = EKEventStore()
    private var pendingCall: CAPPluginCall?

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil else { call.reject("Calendar editor is already open"); return }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard let title = call.getString("title"), !title.isEmpty,
                  let startText = call.getString("start"), let start = formatter.date(from: startText),
                  let endText = call.getString("end"), let end = formatter.date(from: endText), end > start else {
                call.reject("Invalid event details"); return
            }
            self.pendingCall = call
            if #available(iOS 17.0, *) {
                // EventKitUI on iOS 17+ needs no access to existing calendar data.
                self.presentEditor(call, title: title, start: start, end: end)
            } else {
                self.store.requestAccess(to: .event) { granted, _ in
                    DispatchQueue.main.async {
                        if granted { self.presentEditor(call, title: title, start: start, end: end) }
                        else { self.pendingCall = nil; call.reject("Calendar access was not granted") }
                    }
                }
            }
        }
    }

    private func presentEditor(_ call: CAPPluginCall, title: String, start: Date, end: Date) {
        guard let presenter = bridge?.viewController, presenter.presentedViewController == nil else {
            pendingCall = nil; call.reject("Cannot present Calendar right now"); return
        }
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.timeZone = .current
        event.notes = call.getString("notes")
        if let url = call.getString("url"), let parsed = URL(string: url), parsed.scheme == "https" { event.url = parsed }
        event.addAlarm(EKAlarm(relativeOffset: -Double(call.getInt("alarmMinutes") ?? 30) * 60))
        let editor = EKEventEditViewController()
        editor.eventStore = store
        editor.event = event
        editor.editViewDelegate = self
        editor.isModalInPresentation = true
        presenter.present(editor, animated: true)
    }

    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        let call = pendingCall
        controller.dismiss(animated: true) {
            self.pendingCall = nil
            call?.resolve(["status": action == .saved ? "saved" : "cancelled"])
        }
    }
}


// Foreground, approximate location only. No coordinate history is persisted.
@objc(LocationGuidePlugin)
public class LocationGuidePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "LocationGuidePlugin"
    public let jsName = "LocationGuide"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getLocation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]
    private var manager: CLLocationManager?
    private let geocoder = CLGeocoder()
    private var pending: CAPPluginCall?
    private var timeout: DispatchWorkItem?
    private var locating = false

    @objc func getLocation(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("Location request already running"); return }
            self.pending = call
            if self.manager == nil {
                let manager = CLLocationManager()
                manager.desiredAccuracy = kCLLocationAccuracyKilometer
                self.manager = manager
                manager.delegate = self
            }
            self.authorizeOrLocate()
        }
    }
    private func authorizeOrLocate() {
        guard pending != nil, let manager = manager, !locating else { return }
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locating = true
            let task = DispatchWorkItem { [weak self] in self?.fail("Location timed out") }
            timeout = task
            DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: task)
            manager.requestLocation()
        default: fail("Location permission denied or restricted")
        }
    }
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { fail("Location permission denied") }
        else { authorizeOrLocate() }
    }
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let call = pending, let location = locations.last,
              location.horizontalAccuracy >= 0, abs(location.timestamp.timeIntervalSinceNow) < 600 else {
            fail("No recent location available"); return
        }
        manager.stopUpdatingLocation()
        // Available on the app's iOS 15+ deployment target. Apple's geocoder
        // resolves locality/timezone; a network failure falls back to device time.
        geocoder.reverseGeocodeLocation(location) { [weak self] places, _ in
            guard let self = self, self.pending === call else { return }
            let place = places?.first
            var result: [String: Any] = [
                "latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude,
                "accuracy": location.horizontalAccuracy, "timestamp": location.timestamp.timeIntervalSince1970 * 1000
            ]
            if let zone = place?.timeZone?.identifier { result["timeZone"] = zone }
            let label = [place?.locality ?? place?.administrativeArea, place?.country].compactMap { $0 }.joined(separator: ", ")
            if !label.isEmpty { result["place"] = label }
            self.finish()
            call.resolve(result)
        }
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { fail(error.localizedDescription) }
    private func finish() {
        timeout?.cancel(); timeout = nil
        manager?.stopUpdatingLocation()
        pending = nil; locating = false
    }
    private func fail(_ message: String) {
        let call = pending
        finish(); geocoder.cancelGeocode()
        call?.reject(message)
    }
    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.fail("Location cancelled"); call.resolve() }
    }
}

// MapKit planning surface. All encounter data comes from the validated JS feed;
// MapKit supplies the basemap, not Pokémon GO gym or encounter information.
@objc(HuntMapPlugin)
public class HuntMapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HuntMapPlugin"
    public let jsName = "HuntMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise)
    ]
    private var controller: HuntMapViewController?
    private var pending: CAPPluginCall?

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.controller == nil, let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else { call.reject("Map is already open or unavailable"); return }
            guard let lat = call.getDouble("latitude"), let lon = call.getDouble("longitude"),
                  lat.isFinite, lon.isFinite, abs(lat) <= 90, abs(lon) <= 180 else { call.reject("A recent GPS position is required"); return }
            let map = HuntMapViewController()
            map.origin = CLLocation(latitude: lat, longitude: lon)
            map.rows = call.getArray("locations", JSObject.self) ?? []
            map.feedFailed = call.getBool("failed") ?? false
            map.onClose = { [weak self] in
                self?.controller = nil
                self?.pending?.resolve(["status": "closed"])
                self?.pending = nil
            }
            self.controller = map
            self.pending = call
            let navigation = UINavigationController(rootViewController: map)
            navigation.modalPresentationStyle = .fullScreen
            presenter.present(navigation, animated: true)
        }
    }
    @objc func update(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.controller?.rows = call.getArray("locations", JSObject.self) ?? []
            self.controller?.feedFailed = call.getBool("failed") ?? false
            self.controller?.refreshPins()
            call.resolve()
        }
    }
    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.controller?.closeMap(); call.resolve() }
    }
}

private final class HuntAnnotation: MKPointAnnotation {
    let row: JSObject
    init(_ row: JSObject, coordinate: CLLocationCoordinate2D) {
        self.row = row
        super.init()
        self.coordinate = coordinate
        self.title = row["name"] as? String
    }
}

private final class HuntMapViewController: UIViewController, MKMapViewDelegate {
    var origin = CLLocation(latitude: 0, longitude: 0)
    var rows: [JSObject] = []
    var feedFailed = false
    var onClose: (() -> Void)?
    private let map = MKMapView()
    private let filters = UISegmentedControl(items: ["All", "Raid", "Dynamax", "Gigantamax"])
    private let radius = UISegmentedControl(items: ["1 km", "2 km", "5 km", "10 km"])
    private let status = UILabel()
    private let detail = UIStackView()
    private var selectedID: String?
    private var timer: Timer?
    private var imageTask: URLSessionDataTask?
    private let formatter: ISO8601DateFormatter = {
        let value = ISO8601DateFormatter(); value.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return value
    }()
    private let filterValues = ["all", "raid", "dynamax", "gigantamax"]
    private let radii = [1.0, 2.0, 5.0, 10.0]

    private func instant(_ text: String) -> Date? { formatter.date(from: text) ?? ISO8601DateFormatter().date(from: text) }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Hunt map"
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(closeMap))
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Campfire", style: .plain, target: self, action: #selector(openCampfire))
        filters.selectedSegmentIndex = 0; radius.selectedSegmentIndex = 1
        filters.addTarget(self, action: #selector(filtersChanged), for: .valueChanged)
        radius.addTarget(self, action: #selector(radiusChanged), for: .valueChanged)
        map.delegate = self; map.showsUserLocation = true
        status.numberOfLines = 0; status.font = .preferredFont(forTextStyle: .footnote)
        detail.axis = .vertical; detail.spacing = 8
        let stack = UIStackView(arrangedSubviews: [filters, radius, status, map, detail])
        stack.axis = .vertical; stack.spacing = 10; stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            map.heightAnchor.constraint(greaterThanOrEqualToConstant: 160)
        ])
        radiusChanged()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.refreshPins() }
    }
    @objc func closeMap() {
        timer?.invalidate(); timer = nil; imageTask?.cancel(); map.showsUserLocation = false; map.delegate = nil
        dismiss(animated: true) { [weak self] in self?.onClose?(); self?.onClose = nil }
    }
    @objc private func openCampfire() { UIApplication.shared.open(URL(string: "https://campfire.nianticlabs.com/")!) }
    @objc private func filtersChanged() { selectedID = nil; refreshPins() }
    @objc private func radiusChanged() {
        let metres = radii[max(0, radius.selectedSegmentIndex)] * 2200
        map.setRegion(MKCoordinateRegion(center: origin.coordinate, latitudinalMeters: metres, longitudinalMeters: metres), animated: true)
        refreshPins()
    }
    private func activeEncounter(_ row: JSObject) -> JSObject? {
        guard let encounter = row["encounter"] as? JSObject, encounter["verified"] as? Bool == true,
              let startText = encounter["start"] as? String, let start = instant(startText),
              let endText = encounter["end"] as? String, let end = instant(endText),
              start <= Date(), Date() < end else { return nil }
        return encounter
    }
    func refreshPins() {
        guard isViewLoaded else { return }
        map.removeAnnotations(map.annotations.filter { !($0 is MKUserLocation) })
        let selectedFilter = filterValues[max(0, filters.selectedSegmentIndex)]
        let maximum = radii[max(0, radius.selectedSegmentIndex)] * 1000
        var pins: [HuntAnnotation] = []
        for row in rows {
            guard let lat = row["latitude"] as? Double, let lon = row["longitude"] as? Double,
                  lat.isFinite, lon.isFinite, abs(lat) <= 90, abs(lon) <= 180 else { continue }
            if let expiry = row["expiresAt"] as? String, let end = instant(expiry), end <= Date() { continue }
            let place = CLLocation(latitude: lat, longitude: lon)
            guard origin.distance(from: place) <= maximum else { continue }
            let encounter = activeEncounter(row)
            if selectedFilter != "all" && encounter?["battleType"] as? String != selectedFilter { continue }
            pins.append(HuntAnnotation(row, coordinate: place.coordinate))
        }
        map.addAnnotations(pins)
        status.text = "\(pins.count) sourced locations within \(Int(maximum / 1000)) km. Grey pins: known places without a verified active battle.\(feedFailed ? " Feed refresh failed; saved data may be incomplete." : "")"
        if pins.isEmpty { status.text = "No sourced locations match this area/filter. No live Pokémon GO feed is configured. Check Campfire.\(feedFailed ? " Feed could not refresh." : "")" }
        clearDetail()
        if let id = selectedID, let pin = pins.first(where: { $0.row["id"] as? String == id }) { showDetail(pin) }
    }
    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let pin = annotation as? HuntAnnotation else { return nil }
        let marker = MKMarkerAnnotationView(annotation: pin, reuseIdentifier: nil)
        let encounter = activeEncounter(pin.row)
        marker.markerTintColor = encounter == nil ? .systemGray : .systemGreen
        marker.glyphText = encounter == nil ? "?" : encounter?["battleType"] as? String == "raid" ? "R" : "M"
        return marker
    }
    func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
        guard let pin = view.annotation as? HuntAnnotation else { return }
        selectedID = pin.row["id"] as? String; clearDetail(); showDetail(pin)
    }
    func mapView(_ mapView: MKMapView, didUpdate userLocation: MKUserLocation) {
        guard let fix = userLocation.location, fix.horizontalAccuracy >= 0, abs(fix.timestamp.timeIntervalSinceNow) < 600 else { return }
        origin = fix; refreshPins()
    }
    private func clearDetail() {
        imageTask?.cancel()
        for child in detail.arrangedSubviews { detail.removeArrangedSubview(child); child.removeFromSuperview() }
    }
    private func label(_ text: String) {
        let label = UILabel(); label.numberOfLines = 0; label.font = .preferredFont(forTextStyle: .subheadline); label.text = text; detail.addArrangedSubview(label)
    }
    private func showDetail(_ pin: HuntAnnotation) {
        let distance = origin.distance(from: CLLocation(latitude: pin.coordinate.latitude, longitude: pin.coordinate.longitude)) / 1000
        label("\(pin.title ?? "Hunt location") · \(String(format: "%.2f", distance)) km straight line")
        if let encounter = activeEncounter(pin.row) {
            let shiny = encounter["canBeShiny"] as? Bool
            let shinyText = shiny == true ? "Shiny available (source verified)" : shiny == false ? "Shiny unavailable (source verified)" : "Shiny availability unknown"
            label("\(encounter["name"] as? String ?? "Pokémon") · \(encounter["battleType"] as? String ?? "Battle")\n\(shinyText)")
            if let text = encounter["end"] as? String, let end = instant(text) { label("Ends in \(max(0, Int(ceil(end.timeIntervalSinceNow / 60)))) min") }
            if let text = encounter["image"] as? String, let url = URL(string: text), url.scheme == "https",
               ["cdn.leekduck.com", "raw.githubusercontent.com"].contains(url.host ?? "") {
                let image = UIImageView(); image.contentMode = .scaleAspectFit; image.heightAnchor.constraint(equalToConstant: 70).isActive = true; detail.addArrangedSubview(image)
                imageTask = URLSession.shared.dataTask(with: url) { [weak image] data, _, _ in
                    guard let data = data else { return }; DispatchQueue.main.async { image?.image = UIImage(data: data) }
                }; imageTask?.resume()
            }
        } else { label("Known \(pin.row["kind"] as? String ?? "location"). No verified active encounter or countdown.") }
        let directions = UIButton(type: .system); directions.setTitle("Get Directions", for: .normal)
        directions.addAction(UIAction { [weak self] _ in self?.directions(pin) }, for: .touchUpInside); detail.addArrangedSubview(directions)
        if let text = pin.row["source"] as? String, let url = URL(string: text), url.scheme == "https" {
            let source = UIButton(type: .system); source.setTitle("View location source", for: .normal)
            source.addAction(UIAction { _ in UIApplication.shared.open(url) }, for: .touchUpInside); detail.addArrangedSubview(source)
        }
    }
    private func directions(_ pin: HuntAnnotation) {
        let choices = UIAlertController(title: "Get Directions", message: "Open Apple Maps with this destination", preferredStyle: .actionSheet)
        for (title, mode) in [("Walking", MKLaunchOptionsDirectionsModeWalking), ("Driving", MKLaunchOptionsDirectionsModeDriving)] {
            choices.addAction(UIAlertAction(title: title, style: .default) { [weak self] _ in
                let item = MKMapItem(placemark: MKPlacemark(coordinate: pin.coordinate)); item.name = pin.title
                if !item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: mode]) { self?.label("Apple Maps could not open. Try again.") }
            })
        }
        choices.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let popover = choices.popoverPresentationController { popover.sourceView = view; popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1) }
        present(choices, animated: true)
    }
    deinit { timer?.invalidate(); imageTask?.cancel() }
}
