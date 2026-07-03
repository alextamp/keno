// firebase/auth ships getReactNativePersistence only in its React Native bundle
// (dist/rn/index.js). Metro resolves that bundle at runtime, but the TypeScript
// compiler resolves the Node/browser typings which omit this export. This
// augmentation bridges the gap without changing any runtime behaviour.
import type { Persistence } from 'firebase/auth';
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: object): Persistence;
}
