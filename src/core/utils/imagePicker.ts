import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getTranslations } from '@/core/i18n';

export interface PickImageOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

async function pickFrom(source: 'camera' | 'library', options: PickImageOptions): Promise<string | null> {
  // Callers await this directly, outside their own try/catch (they only
  // wrap the upload step) — a permission or picker rejection here used to
  // propagate as an unhandled promise rejection, which reads to the user as
  // "I pressed the button and nothing happened." Never throw; null reads
  // the same as a cancel everywhere this is called.
  try {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return null;

    const result = await (source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing ?? true,
      aspect: options.aspect,
      quality: options.quality ?? 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0].uri;
  } catch {
    return null;
  }
}

// Every photo-upload flow in the app (event photo wall, avatars, chat
// images, verification photos, group/event covers) used to be gallery-only.
// This is the shared "camera or library?" prompt so users can shoot a photo
// on the spot instead of only ever picking an existing one — swap in for a
// direct ImagePicker.launchImageLibraryAsync call.
export function pickImage(options: PickImageOptions = {}): Promise<string | null> {
  const t = getTranslations();
  return new Promise((resolve) => {
    Alert.alert(
      t.imagePickerTitle,
      undefined,
      [
        { text: t.imagePickerCamera, onPress: () => { pickFrom('camera', options).then(resolve); } },
        { text: t.imagePickerLibrary, onPress: () => { pickFrom('library', options).then(resolve); } },
        { text: t.settingsBtnCancel, style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
