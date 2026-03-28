// MusicActivityAttributes.swift
// Shared Activity Attributes — this file is identical in both targets.
// If you modify this, update the copy in MusicPlayer/ as well.
import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
public struct MusicActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var isPlaying: Bool
    var title: String
    var artist: String
    var progress: Double          // 0.0–1.0
    var artworkBase64: String?    // small JPEG thumbnail (≤ 60KB)
  }

  public var trackId: String
}
#endif
