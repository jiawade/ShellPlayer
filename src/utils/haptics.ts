// src/utils/haptics.ts
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

/** Light tap – button press, list item tap */
export function hapticLight() {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactLight, options);
}

/** Medium tap – play/pause, toggle, EQ change */
export function hapticMedium() {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.impactMedium, options);
}

/** Selection tick – alphabet scroll, slider step */
export function hapticSelection() {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.selection, options);
}

/** Success – save completed, timer set */
export function hapticSuccess() {
  ReactNativeHapticFeedback.trigger(HapticFeedbackTypes.notificationSuccess, options);
}
