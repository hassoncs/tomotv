import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LibraryProvider } from "@/contexts/LibraryContext";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LoadingProvider>
        <LibraryProvider>
          <ThemeProvider value={DarkTheme}>
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
            <StatusBar
              style="light"
              backgroundColor="transparent"
              translucent={true}
            />
          </ThemeProvider>
        </LibraryProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};
