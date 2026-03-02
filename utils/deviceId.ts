import { Platform } from 'react-native';

/**
 * Stable device identifier for the bridge relay HELLO handshake.
 *
 * Distinguishes multiple app instances (simulator vs physical device, etc.)
 * so they don't evict each other from the relay's app slot.
 *
 * Uses a deterministic ID based on the runtime environment:
 *   - tvOS simulator: "simulator-<pid>"
 *   - tvOS device:    "device-<randomHex>" (stable for the app lifetime)
 *
 * This doesn't need to survive app restarts — it just needs to be unique
 * per running instance so the relay can tell them apart.
 */

let _cachedId: string | null = null;

export function getDeviceId(): string {
  if (_cachedId) return _cachedId;

  const isSimulator = __DEV__ && Platform.isTV;
  const prefix = isSimulator ? 'sim' : 'dev';

  // process.pid is unique per OS process — gives us stable identity for this run
  const pid = typeof process !== 'undefined' ? process.pid : 0;
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

  _cachedId = `${prefix}-${pid}-${rand}`;
  return _cachedId;
}
