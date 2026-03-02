import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, LogBox, AppState, type AppStateStatus, View, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { DynamicBackground } from "@/components/DynamicBackground";
import { BackgroundProvider, useBackground } from "@/contexts/BackgroundContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { FolderNavigationProvider } from "@/contexts/FolderNavigationContext";
import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { registerMultiAudioPlugin } from "@/services/multiAudioLoader";
import { syncDevCredentials } from "@/services/jellyfinApi";
import { remoteBridgeService } from "@/services/remoteBridgeService";
import { playbackController } from "@/services/playbackController";
import { componentRegistry } from "@/services/componentRegistry";
import "@/components/sdui/registerComponents";

const SHOW_BRIDGE_STATUS = __DEV__;
if (Platform.isTV) {
  LogBox.ignoreAllLogs(true);
}

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0A0A0A",
  },
};

function RootLayoutContent({ bridgeConnected }: { bridgeConnected: boolean }) {
  const { currentImageSource } = useBackground();

  return (
    <>
      <DynamicBackground source={currentImageSource} />
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
    </>
  );
}

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

    remoteBridgeService.start();

    const unsubBridge = remoteBridgeService.subscribe(({ connected }) => {
      setBridgeConnected(connected);
    });

    const unsubSdui = componentRegistry.onRender((payload) => {
      if (payload.target === 'canvas' && payload.navigateToTab) {
        router.push('/(tabs)/ai' as any);
      } else if (payload.target === 'overlay') {
        router.push('/sdui' as any);
      }
    });

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <LibraryProvider>
          <FolderNavigationProvider>
            <PlayQueueProvider>
              <BackgroundProvider>
                <ThemeProvider value={CustomDarkTheme}>
                  <RootLayoutContent bridgeConnected={bridgeConnected} />
                </ThemeProvider>
              </BackgroundProvider>
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
    backgroundColor: "#34C759",
  },
  dotOff: {
    backgroundColor: "#FF3B30",
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
