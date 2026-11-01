import UIKit
import Capacitor
import EventKit
import EventKitUI
import CoreLocation

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
