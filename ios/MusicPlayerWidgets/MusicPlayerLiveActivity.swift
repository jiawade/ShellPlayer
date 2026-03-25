// MusicPlayerLiveActivity.swift
// Dynamic Island and Lock Screen Live Activity UI
import ActivityKit
import WidgetKit
import SwiftUI

// Rainbow colors: 赤橙黄绿青蓝紫
private let rainbowColors: [Color] = [
  Color(red: 1.0, green: 0.2, blue: 0.2),   // 赤 red
  Color(red: 1.0, green: 0.6, blue: 0.0),   // 橙 orange
  Color(red: 1.0, green: 0.9, blue: 0.0),   // 黄 yellow
  Color(red: 0.2, green: 0.9, blue: 0.3),   // 绿 green
  Color(red: 0.0, green: 0.9, blue: 0.8),   // 青 cyan
  Color(red: 0.2, green: 0.4, blue: 1.0),   // 蓝 blue
  Color(red: 0.6, green: 0.2, blue: 1.0),   // 紫 purple
]

// MARK: - Rainbow Audio Bars
@available(iOS 16.1, *)
struct RainbowBars: View {
  let levels: [Double]
  let barWidth: CGFloat
  let maxHeight: CGFloat
  let spacing: CGFloat

  init(levels: [Double], barWidth: CGFloat = 3, maxHeight: CGFloat = 20, spacing: CGFloat = 2) {
    self.levels = levels
    self.barWidth = barWidth
    self.maxHeight = maxHeight
    self.spacing = spacing
  }

  var body: some View {
    HStack(alignment: .bottom, spacing: spacing) {
      ForEach(0..<min(levels.count, 7), id: \.self) { i in
        let level = max(0.08, min(1.0, levels.count > i ? levels[i] : 0))
        RoundedRectangle(cornerRadius: barWidth / 2)
          .fill(rainbowColors[i % rainbowColors.count])
          .frame(width: barWidth, height: max(barWidth, maxHeight * level))
          .shadow(color: rainbowColors[i % rainbowColors.count].opacity(0.5), radius: 2)
      }
    }
  }
}

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
          RainbowBars(
            levels: context.state.audioLevels,
            barWidth: 4,
            maxHeight: 36,
            spacing: 3
          )
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
                .fill(
                  LinearGradient(
                    colors: rainbowColors,
                    startPoint: .leading,
                    endPoint: .trailing
                  )
                )
                .frame(width: geo.size.width * max(0, min(1, context.state.progress)), height: 3)
            }
          }
          .frame(height: 3)
          .padding(.horizontal, 8)
          .padding(.top, 4)
        }
      } compactLeading: {
        // Small artwork in compact leading
        ArtworkView(base64: context.state.artworkBase64, size: 24)
      } compactTrailing: {
        // Small rainbow bars in compact trailing
        RainbowBars(
          levels: context.state.audioLevels,
          barWidth: 2,
          maxHeight: 12,
          spacing: 1.5
        )
      } minimal: {
        // Minimal: just a music note icon with accent
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

      RainbowBars(
        levels: context.state.audioLevels,
        barWidth: 3,
        maxHeight: 28,
        spacing: 2
      )
    }
    .padding(12)
    .background(Color.black.opacity(0.8))
  }
}
