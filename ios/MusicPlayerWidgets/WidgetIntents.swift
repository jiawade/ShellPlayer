// WidgetIntents.swift
// AppIntents for interactive widget buttons (iOS 17+)
// Uses Darwin notifications to signal the main app without opening it.
import Foundation
import WidgetKit

#if canImport(AppIntents)
import AppIntents

/// Post a Darwin notification so the main app (running in background for audio)
/// picks up the command from shared UserDefaults immediately.
private func notifyMainApp() {
  let name = "com.musicplayer.widgetCommand" as CFString
  CFNotificationCenterPostNotification(
    CFNotificationCenterGetDarwinNotifyCenter(),
    CFNotificationName(name),
    nil, nil, true
  )
}

@available(iOS 17.0, *)
struct PlayPauseIntent: AppIntent {
  static var title: LocalizedStringResource = "Play/Pause"
  static var description: IntentDescription = "Toggle playback"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: "group.com.musicplayer.shared")!
    // Toggle isPlaying in UserDefaults for immediate widget UI feedback
    let wasPlaying = defaults.bool(forKey: "widget_isPlaying")
    defaults.set(!wasPlaying, forKey: "widget_isPlaying")
    defaults.set("play_pause", forKey: "widget_command")
    defaults.synchronize()
    notifyMainApp()
    // Reload timelines so the widget shows updated play/pause icon immediately
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

@available(iOS 17.0, *)
struct NextTrackIntent: AppIntent {
  static var title: LocalizedStringResource = "Next Track"
  static var description: IntentDescription = "Skip to next track"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: "group.com.musicplayer.shared")!
    defaults.set("next", forKey: "widget_command")
    defaults.synchronize()
    notifyMainApp()
    return .result()
  }
}

@available(iOS 17.0, *)
struct PrevTrackIntent: AppIntent {
  static var title: LocalizedStringResource = "Previous Track"
  static var description: IntentDescription = "Go to previous track"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: "group.com.musicplayer.shared")!
    defaults.set("prev", forKey: "widget_command")
    defaults.synchronize()
    notifyMainApp()
    return .result()
  }
}
#endif
