import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, LogBox } from "react-native";
import { useEffect } from "react";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { FolderNavigationProvider } from "@/contexts/FolderNavigationContext";
import { registerMultiAudioPlugin } from "@/services/multiAudioLoader";

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
  // Register multi-audio plugin on app startup
  useEffect(() => {
    registerMultiAudioPlugin();
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <LibraryProvider>
          <FolderNavigationProvider>
            <ThemeProvider value={CustomDarkTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="player"
                  options={{
                    headerShown: false,
                    presentation: "fullScreenModal",
                    animation: "none",
                  }}
                />
              </Stack>
              <StatusBar style="light" backgroundColor="transparent" translucent={true} />
            </ThemeProvider>
          </FolderNavigationProvider>
        </LibraryProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};
