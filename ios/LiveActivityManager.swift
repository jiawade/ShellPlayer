// LiveActivityManager.swift
// Manages Live Activity (Dynamic Island) from the main app target.
import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
@objc(LiveActivityManager)
class LiveActivityManager: NSObject {

  private var currentActivity: Activity<MusicActivityAttributes>?

  // MARK: - Start
  @objc func start(
    _ trackId: String,
    title: String,
    artist: String,
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
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
      artworkBase64: artworkBase64
    )
    let content = ActivityContent(state: state, staleDate: nil)

    // End any existing activity first
    if let existing = currentActivity {
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
      currentActivity = activity
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
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let activity = currentActivity else {
      reject("LA_NO_ACTIVITY", "No active Live Activity", nil)
      return
    }
    let state = MusicActivityAttributes.ContentState(
      isPlaying: isPlaying,
      title: title,
      artist: artist,
      progress: progress,
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
    guard let activity = currentActivity else {
      resolve(nil)
      return
    }
    Task {
      await activity.end(nil, dismissalPolicy: .immediate)
      currentActivity = nil
      resolve(nil)
    }
  }

  // MARK: - Check support
  @objc func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.1, *) {
      resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
    } else {
      resolve(false)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
#else
// Fallback for iOS < 16.1 compilation
@objc(LiveActivityManager)
class LiveActivityManager: NSObject {
  @objc func start(
    _ trackId: String,
    title: String,
    artist: String,
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { reject("LA_UNSUPPORTED", "Live Activities require iOS 16.1+", nil) }

  @objc func update(
    _ isPlaying: Bool,
    title: String,
    artist: String,
    progress: Double,
    artworkBase64: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { reject("LA_UNSUPPORTED", "Live Activities require iOS 16.1+", nil) }

  @objc func stop(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { resolve(nil) }

  @objc func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { resolve(false) }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
#endif
