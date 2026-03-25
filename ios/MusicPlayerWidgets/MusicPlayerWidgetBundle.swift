// MusicPlayerWidgetBundle.swift
// Entry point for the Widget Extension
import WidgetKit
import SwiftUI

@main
struct MusicPlayerWidgetBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.1, *) {
      MusicPlayerLiveActivity()
    }
  }
}
