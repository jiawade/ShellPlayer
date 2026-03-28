// MusicPlayerLiveActivity.swift
// Dynamic Island and Lock Screen Live Activity UI
import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Artwork View
@available(iOS 16.1, *)
struct ArtworkView: View {
  let base64: String?
  let size: CGFloat

  var body: some View {
    if let b64 = base64, let data = Data(base64Encoded: b64), let uiImage = UIImage(data: data) {
      Image(uiImage: uiImage)
        .resizable()
        .aspectRatio(contentMode: .fill)
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.18))
    } else {
      RoundedRectangle(cornerRadius: size * 0.18)
        .fill(Color.white.opacity(0.1))
        .frame(width: size, height: size)
        .overlay(
          Image(systemName: "music.note")
            .foregroundColor(.white.opacity(0.4))
            .font(.system(size: size * 0.4))
        )
    }
  }
}

// MARK: - Live Activity Definition
@available(iOS 16.1, *)
struct MusicPlayerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MusicActivityAttributes.self) { context in
      // Lock Screen banner
      lockScreenView(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        // Expanded regions
        DynamicIslandExpandedRegion(.leading) {
          ArtworkView(base64: context.state.artworkBase64, size: 52)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
            .foregroundColor(.cyan)
            .font(.system(size: 22, weight: .medium))
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(context.state.title)
              .font(.system(size: 14, weight: .semibold))
              .foregroundColor(.white)
              .lineLimit(1)
            Text(context.state.artist)
              .font(.system(size: 11))
              .foregroundColor(.white.opacity(0.6))
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          // Progress bar
          GeometryReader { geo in
            ZStack(alignment: .leading) {
              RoundedRectangle(cornerRadius: 1.5)
                .fill(Color.white.opacity(0.15))
                .frame(height: 3)
              RoundedRectangle(cornerRadius: 1.5)
                .fill(Color.cyan)
                .frame(width: geo.size.width * max(0, min(1, context.state.progress)), height: 3)
            }
          }
          .frame(height: 3)
          .padding(.horizontal, 8)
          .padding(.top, 4)
        }
      } compactLeading: {
        ArtworkView(base64: context.state.artworkBase64, size: 24)
      } compactTrailing: {
        Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
          .foregroundColor(.cyan)
          .font(.system(size: 12, weight: .bold))
      } minimal: {
        Image(systemName: context.state.isPlaying ? "music.note" : "pause.fill")
          .foregroundColor(.cyan)
          .font(.system(size: 12, weight: .bold))
      }
    }
  }

  @ViewBuilder
  private func lockScreenView(context: ActivityViewContext<MusicActivityAttributes>) -> some View {
    HStack(spacing: 12) {
      ArtworkView(base64: context.state.artworkBase64, size: 44)

      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.title)
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(.white)
          .lineLimit(1)
        Text(context.state.artist)
          .font(.system(size: 11))
          .foregroundColor(.white.opacity(0.6))
          .lineLimit(1)
      }

      Spacer()

      Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
        .foregroundColor(.cyan)
        .font(.system(size: 20, weight: .medium))
    }
    .padding(12)
    .background(Color.black.opacity(0.8))
  }
}
