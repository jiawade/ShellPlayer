// LiveActivityManager.swift
// Manages Live Activity (Dynamic Island) from the main app target.
import Foundation
import ActivityKit

@objc(LiveActivityManager)
class LiveActivityManager: NSObject {

  private var _currentActivity: Any?

  // MARK: - Start
  @objc func start(
    _ trackId: String,
    title: String,
    artist: String,
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else {
      reject("LA_UNSUPPORTED", "Live Activities require iOS 16.2+", nil)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      reject("LA_DISABLED", "Live Activities are not enabled", nil)
      return
    }
    let attr = MusicActivityAttributes(trackId: trackId)
    let state = MusicActivityAttributes.ContentState(
      isPlaying: true,
      title: title,
      artist: artist,
      progress: 0,
      audioLevels: Array(repeating: 0, count: 7),
      artworkBase64: artworkBase64
    )
    let content = ActivityContent(state: state, staleDate: nil)

    // End any existing activity first
    if let existing = _currentActivity as? Activity<MusicActivityAttributes> {
      Task {
        await existing.end(nil, dismissalPolicy: .immediate)
      }
    }

    do {
      let activity = try Activity<MusicActivityAttributes>.request(
        attributes: attr,
        content: content,
        pushType: nil
      )
      _currentActivity = activity
      resolve(activity.id)
    } catch {
      reject("LA_START_ERR", error.localizedDescription, error)
    }
  }

  // MARK: - Update
  @objc func update(
    _ isPlaying: Bool,
    title: String,
    artist: String,
    progress: Double,
    audioLevels: [Double],
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else {
      reject("LA_UNSUPPORTED", "Live Activities require iOS 16.2+", nil)
      return
    }
    guard let activity = _currentActivity as? Activity<MusicActivityAttributes> else {
      reject("LA_NO_ACTIVITY", "No active Live Activity", nil)
      return
    }
    let state = MusicActivityAttributes.ContentState(
      isPlaying: isPlaying,
      title: title,
      artist: artist,
      progress: progress,
      audioLevels: audioLevels,
      artworkBase64: artworkBase64
    )
    Task {
      await activity.update(ActivityContent(state: state, staleDate: nil))
      resolve(nil)
    }
  }

  // MARK: - Stop
  @objc func stop(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.2, *) else {
      resolve(nil)
      return
    }
    guard let activity = _currentActivity as? Activity<MusicActivityAttributes> else {
      resolve(nil)
      return
    }
    Task {
      await activity.end(nil, dismissalPolicy: .immediate)
      _currentActivity = nil
      resolve(nil)
    }
  }

  // MARK: - Check support
  @objc func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.2, *) {
      resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
    } else {
      resolve(false)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
