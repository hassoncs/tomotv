import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { ErrorBoundary } from "@/components/error-boundary";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
    </ErrorBoundary>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};
