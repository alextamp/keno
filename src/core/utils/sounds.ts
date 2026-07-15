import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Without this, iOS silences all playback whenever the phone's physical
// mute switch is on — sound effects would appear to "not work" for anyone
// testing with silent mode enabled, which is the common default.
setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});

const SOURCES = {
  success: require('../../../assets/sounds/success.mp3'),
  levelUp: require('../../../assets/sounds/level-up.mp3'),
  notification: require('../../../assets/sounds/notification.mp3'),
  click: require('../../../assets/sounds/click.mp3'),
} as const;

type SoundKey = keyof typeof SOURCES;

const players: Partial<Record<SoundKey, AudioPlayer>> = {};

function getPlayer(key: SoundKey): AudioPlayer {
  if (!players[key]) {
    players[key] = createAudioPlayer(SOURCES[key]);
  }
  return players[key]!;
}

export const sounds = {
  async play(key: SoundKey) {
    try {
      const player = getPlayer(key);
      await player.seekTo(0);
      player.play();
    } catch {
      // Best-effort — a sound failing to play should never break the
      // actual action (joining an event, leveling up, etc.).
    }
  },
};
