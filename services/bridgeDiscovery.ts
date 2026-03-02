/**
 * bridgeDiscovery.ts — stub, always returns the hardcoded relay URL.
 * mDNS/Bonjour discovery can be wired in here later without touching any other code.
 */

export function discoverRelayUrl(): Promise<string> {
  const env = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_REMOTE_BRIDGE_RELAY_URL : undefined;
  return Promise.resolve(env && env.length > 0 ? env : 'ws://openclaw.lan:9091/radmedia');
}
