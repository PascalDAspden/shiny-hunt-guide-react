import UIKit
import Capacitor
import EventKit
import EventKitUI

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
