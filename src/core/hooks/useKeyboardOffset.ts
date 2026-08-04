import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// On Android, `windowSoftInputMode="adjustResize"` (set in AndroidManifest)
// stops actually resizing the window once edge-to-edge display is enabled
// (android/gradle.properties: edgeToEdgeEnabled=true, required for Android
// 15+ targeting) — the OS draws behind the IME instead of shrinking the
// content, so KeyboardAvoidingView's 'height' behavior has nothing to react
// to and chat input bars end up hidden behind the keyboard. iOS isn't
// affected (its 'padding' behavior works regardless), so this only tracks
// the keyboard height on Android for manually offsetting the input bar.
export function useKeyboardOffset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
