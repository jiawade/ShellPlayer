// WidgetReloader.swift
// ObjC-accessible helper to reload WidgetKit timelines from the main app.
import Foundation
import WidgetKit

@objc(WidgetReloader)
class WidgetReloader: NSObject {
  @objc static func reloadAll() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
