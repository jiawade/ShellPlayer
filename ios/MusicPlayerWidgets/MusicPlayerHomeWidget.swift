// MusicPlayerHomeWidget.swift
// Home Screen Widget for Music X
import WidgetKit
import SwiftUI

#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - Shared data via App Group UserDefaults
struct MusicWidgetData {
  static let suiteName = "group.com.musicplayer.shared"

  var title: String
  var artist: String
  var isPlaying: Bool
  var artworkBase64: String?
  var progress: Double  // 0.0–1.0
  var duration: Double  // total duration in seconds
  var bgR: Double?
  var bgG: Double?
  var bgB: Double?

  static func load() -> MusicWidgetData {
    let defaults = UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
    let hasColor = defaults.object(forKey: "widget_bgR") != nil
    return MusicWidgetData(
      title: defaults.string(forKey: "widget_title") ?? "Music X",
      artist: defaults.string(forKey: "widget_artist") ?? "",
      isPlaying: defaults.bool(forKey: "widget_isPlaying"),
      artworkBase64: defaults.string(forKey: "widget_artworkBase64"),
      progress: defaults.double(forKey: "widget_progress"),
      duration: defaults.double(forKey: "widget_duration"),
      bgR: hasColor ? defaults.double(forKey: "widget_bgR") : nil,
      bgG: hasColor ? defaults.double(forKey: "widget_bgG") : nil,
      bgB: hasColor ? defaults.double(forKey: "widget_bgB") : nil
    )
  }
}

// MARK: - Timeline Provider
struct MusicWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> MusicWidgetEntry {
    MusicWidgetEntry(date: Date(), data: MusicWidgetData(title: "Music X", artist: "Not Playing", isPlaying: false, artworkBase64: nil, progress: 0.35, duration: 0, bgR: nil, bgG: nil, bgB: nil))
  }

  func getSnapshot(in context: Context, completion: @escaping (MusicWidgetEntry) -> Void) {
    completion(MusicWidgetEntry(date: Date(), data: MusicWidgetData.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MusicWidgetEntry>) -> Void) {
    let data = MusicWidgetData.load()
    var entries: [MusicWidgetEntry] = []
    let now = Date()

    if data.isPlaying && data.duration > 0 {
      // Generate entries every 5 seconds to animate progress
      let remainingRatio = 1.0 - data.progress
      let remainingSec = remainingRatio * data.duration
      let steps = min(60, Int(remainingSec / 5) + 1) // up to 5 minutes of entries

      for i in 0..<steps {
        let offset = Double(i) * 5.0
        let predicted = min(1.0, data.progress + (offset / data.duration))
        var entryData = data
        entryData.progress = predicted
        entries.append(MusicWidgetEntry(date: now.addingTimeInterval(offset), data: entryData))
      }

      let nextUpdate = now.addingTimeInterval(min(remainingSec + 1, 300))
      let timeline = Timeline(entries: entries, policy: .after(nextUpdate))
      completion(timeline)
    } else {
      entries.append(MusicWidgetEntry(date: now, data: data))
      let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
      let timeline = Timeline(entries: entries, policy: .after(nextUpdate))
      completion(timeline)
    }
  }
}

// MARK: - Timeline Entry
struct MusicWidgetEntry: TimelineEntry {
  let date: Date
  let data: MusicWidgetData
}

// MARK: - Widget View
struct MusicWidgetView: View {
  var entry: MusicWidgetEntry
  @Environment(\.widgetFamily) var family

  private let accentColor = Color(red: 0.43, green: 0.78, blue: 0.96)  // #6EC7F5
  private let contentInset: CGFloat = 0
  // 稳妥放大：artworkBleed = 10，HStack(spacing: 4)
  // 激进贴边：artworkBleed = 12，HStack(spacing: 2)
  private let artworkBleed: CGFloat = 9
  private let progressRightInset: CGFloat = 0

  private let fallbackBg = Color.white

  /// Use pre-computed average color from main app (fast path)
  private var dynamicBgColor: Color {
    // Keep widget on a clean white theme as requested.
    return fallbackBg
  }

  var body: some View {
    mediumView
  }

  // MARK: Medium Widget (4×1)
  var mediumView: some View {
    GeometryReader { containerGeo in
      let artworkSize = max(72, containerGeo.size.height - (contentInset * 2) + (artworkBleed * 2))

      HStack(spacing: 5) {
        // Make artwork fill the available height after uniform insets.
        artworkImage(size: artworkSize)
          .padding(.leading, -artworkBleed)
          .padding(.vertical, -artworkBleed)

        // Right side: song info on top, controls at bottom
        VStack(alignment: .leading, spacing: 0) {
          // Song title
          Text(entry.data.title)
            .font(.system(size: 15, weight: .bold))
            .foregroundColor(.black)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .allowsTightening(true)
            .truncationMode(.tail)

          // Artist
          Text(entry.data.artist.isEmpty ? "Music X" : entry.data.artist)
            .font(.system(size: 12))
            .foregroundColor(.black.opacity(0.55))
            .lineLimit(1)
            .padding(.top, 2)

          Spacer(minLength: 4)

          // Progress bar
          GeometryReader { geo in
            let trackWidth = max(0, geo.size.width * 0.85)
            ZStack(alignment: .leading) {
              RoundedRectangle(cornerRadius: 1.5)
                .fill(Color.black.opacity(0.12))
                .frame(width: trackWidth, height: 3, alignment: .leading)
              RoundedRectangle(cornerRadius: 1.5)
                .fill(accentColor)
                .frame(width: trackWidth * max(0, min(1, entry.data.progress)), height: 3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
          .frame(height: 3)

          Spacer(minLength: 6)

          // Playback controls
          HStack(spacing: 20) {
            Spacer()
            controlButton(systemName: "backward.fill", action: "prev", size: 18)
            playPauseButton
            controlButton(systemName: "forward.fill", action: "next", size: 18)
            Spacer()
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.leading, contentInset)
      .padding(.trailing, 16)
      .padding(.vertical, contentInset)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .widgetBackground(dynamicBgColor)
  }

  // MARK: Play/Pause button (larger, with circle background)
  var playPauseButton: some View {
    Group {
      if #available(iOS 17.0, *) {
        #if canImport(AppIntents)
        Button(intent: PlayPauseIntent()) {
          playPauseLabel
        }
        .buttonStyle(.plain)
        #else
        Link(destination: URL(string: "musicx://play_pause")!) {
          playPauseLabel
        }
        #endif
      } else {
        Link(destination: URL(string: "musicx://play_pause")!) {
          playPauseLabel
        }
      }
    }
  }

  var playPauseLabel: some View {
    ZStack {
      Circle()
        .fill(accentColor.opacity(0.16))
        .frame(width: 38, height: 38)
      Image(systemName: entry.data.isPlaying ? "pause.fill" : "play.fill")
        .font(.system(size: 18, weight: .bold))
        .foregroundColor(accentColor)
    }
  }

  // MARK: Control button helper
  func controlButton(systemName: String, action: String, size: CGFloat) -> some View {
    Group {
      if #available(iOS 17.0, *) {
        #if canImport(AppIntents)
        Button(intent: intentForAction(action)) {
          Image(systemName: systemName)
            .font(.system(size: size, weight: .semibold))
            .foregroundColor(.black.opacity(0.72))
            .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        #else
        Link(destination: URL(string: "musicx://\(action)")!) {
          Image(systemName: systemName)
            .font(.system(size: size, weight: .semibold))
            .foregroundColor(.black.opacity(0.72))
            .frame(width: 36, height: 36)
        }
        #endif
      } else {
        Link(destination: URL(string: "musicx://\(action)")!) {
          Image(systemName: systemName)
            .font(.system(size: size, weight: .semibold))
            .foregroundColor(.black.opacity(0.72))
            .frame(width: 36, height: 36)
        }
      }
    }
  }

  @available(iOS 17.0, *)
  func intentForAction(_ action: String) -> any AppIntent {
    switch action {
    case "prev": return PrevTrackIntent()
    case "next": return NextTrackIntent()
    default: return PlayPauseIntent()
    }
  }

  // MARK: Artwork helper
  func artworkImage(size: CGFloat) -> some View {
    Group {
      if let b64 = entry.data.artworkBase64,
         let data = Data(base64Encoded: b64),
         let uiImage = UIImage(data: data) {
        Image(uiImage: uiImage)
          .resizable()
          .aspectRatio(contentMode: .fill)
          .frame(width: size, height: size)
          .clipShape(RoundedRectangle(cornerRadius: size * 0.16))
      } else {
        RoundedRectangle(cornerRadius: size * 0.16)
          .fill(Color.black.opacity(0.06))
          .frame(width: size, height: size)
          .overlay(
            Image(systemName: "music.note")
              .foregroundColor(.black.opacity(0.35))
              .font(.system(size: size * 0.35))
          )
      }
    }
  }
}

// MARK: - Widget Background Modifier (iOS version compat)
extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(color, for: .widget)
    } else {
      self.background(color)
    }
  }
}

// MARK: - Widget Definition
struct MusicPlayerHomeWidget: Widget {
  let kind: String = "MusicPlayerHomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MusicWidgetProvider()) { entry in
      MusicWidgetView(entry: entry)
    }
    .configurationDisplayName("Music X")
    .description("Show currently playing song")
    .supportedFamilies([.systemMedium])
  }
}
