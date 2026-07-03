import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';

function extToMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadToStorage(
  path: string,
  localUri: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  // Force token refresh so the SDK has a valid token before the upload starts
  await currentUser.getIdToken(true);

  const ext = path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = extToMime(ext);

  // Read the local file via fetch (works with file:// URIs in React Native)
  const fileRes = await fetch(localUri);
  if (!fileRes.ok) throw new Error(`Could not read local file (${fileRes.status})`);
  const blob = await fileRes.blob();

  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, blob, { contentType });

    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

export async function uploadEventImage(
  localUri: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  return uploadToStorage(`events/${Date.now()}.${ext}`, localUri, onProgress);
}

export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  return uploadToStorage(`avatars/${uid}.${ext}`, localUri, onProgress);
}
