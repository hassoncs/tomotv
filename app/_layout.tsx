import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, LogBox, AppState, type AppStateStatus, View, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { FolderNavigationProvider } from "@/contexts/FolderNavigationContext";
import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { registerMultiAudioPlugin } from "@/services/multiAudioLoader";
import { syncDevCredentials } from "@/services/jellyfinApi";
import { remoteBridgeService } from "@/services/remoteBridgeService";
import { playbackController } from "@/services/playbackController";
import { componentRegistry } from "@/services/componentRegistry";
import "@/components/sdui/registerComponents"; // register SDUI components before any bridge command arrives

// ─── Dev-mode bridge status indicator ───────────────────────────────────────
// Flip to false before shipping to production.
const SHOW_BRIDGE_STATUS = __DEV__;
// Suppress yellow box warnings on TV platforms
if (Platform.isTV) {
  LogBox.ignoreAllLogs(true);
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#3d3d3d",
  },
};

export default function RootLayout() {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [bridgeConnected, setBridgeConnected] = useState(false);

  useEffect(() => {
    registerMultiAudioPlugin();
    syncDevCredentials();

    playbackController.registerRouter({
      push: (route: string, params?: Record<string, string>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push({ pathname: route as any, params });
      },
      back: () => router.back(),
    });

    // Start the WebSocket relay connection
    remoteBridgeService.start();

    // Mirror connection state into local React state for the dev indicator
    const unsubBridge = remoteBridgeService.subscribe(({ connected }) => {
      setBridgeConnected(connected);
    });

    // Auto-navigate to the SDUI canvas whenever a render command arrives
    const unsubSdui = componentRegistry.onRender((payload) => {
      if (payload.target === 'canvas' && payload.navigateToTab) {
        router.push('/(tabs)/ai' as any);
      } else if (payload.target === 'overlay') {
        router.push('/sdui' as any);
      }
    });

    // Re-connect immediately when app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;
      if (prev !== 'active' && nextState === 'active') {
        if (!remoteBridgeService.isConnected()) {
          remoteBridgeService.reconnectNow();
        }
      }
    });

    return () => {
      appStateSub.remove();
      unsubBridge();
      unsubSdui();
      remoteBridgeService.stop();
      playbackController.unregisterRouter();
    };
  // router instance is stable — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <LibraryProvider>
          <FolderNavigationProvider>
            <PlayQueueProvider>
              <ThemeProvider value={CustomDarkTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="player"
                    options={{
                      headerShown: false,
                      presentation: "fullScreenModal",
                      animation: "fade",
                    }}
                  />
                  <Stack.Screen name="sdui" options={{ headerShown: false, presentation: "transparentModal" }} />
                </Stack>
                <StatusBar style="light" backgroundColor="transparent" translucent={true} />
                {SHOW_BRIDGE_STATUS && (
                  <View style={styles.bridgeDot} pointerEvents="none">
                    <View style={[styles.dot, bridgeConnected ? styles.dotOn : styles.dotOff]} />
                    <Text style={styles.dotLabel}>
                      {bridgeConnected ? "WS" : "WS"}
                    </Text>
                  </View>
                )}
              </ThemeProvider>
            </PlayQueueProvider>
          </FolderNavigationProvider>
        </LibraryProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  bridgeDot: {
    position: "absolute",
    top: 24,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 9999,
    pointerEvents: "none",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotOn: {
    backgroundColor: "#34C759", // green
  },
  dotOff: {
    backgroundColor: "#FF3B30", // red
  },
  dotLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});


export const unstable_settings = {
  anchor: "(tabs)",
};
