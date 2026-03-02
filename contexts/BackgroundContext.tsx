import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { extractAccentColor } from "@/utils/colorExtraction";

export type ScreenContext = "home" | "movies" | "tvshows" | "search" | "settings" | "continueWatching";
export type ImageSource = { uri: string } | number;

interface BackgroundContextType {
  setBackdropUrl: (url: string | undefined) => void;
  setScreenContext: (context: ScreenContext) => void;
  currentImageSource: ImageSource | undefined;
  /** rgba() tint string extracted from the current backdrop, or undefined to use default */
  accentColor: string | undefined;
}

const AMBIENT_BACKGROUNDS: Record<ScreenContext, ImageSource> = {
  home: require("@/assets/backgrounds/home-ambient.png"),
  movies: require("@/assets/backgrounds/movies-ambient.png"),
  tvshows: require("@/assets/backgrounds/tvshows-ambient.png"),
  search: require("@/assets/backgrounds/search-ambient.png"),
  settings: require("@/assets/backgrounds/settings-ambient.png"),
  continueWatching: require("@/assets/backgrounds/continue-watching-ambient.png"),
};

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backdropUrl, setBackdropUrlState] = useState<string | undefined>(undefined);
  const [screenContext, setScreenContextState] = useState<ScreenContext>("home");
  const [accentColor, setAccentColor] = useState<string | undefined>(undefined);
  const extractionRef = useRef<string | undefined>(undefined);

  const setBackdropUrl = useCallback((url: string | undefined) => {
    setBackdropUrlState(url);
  }, []);

  const setScreenContext = useCallback((context: ScreenContext) => {
    setScreenContextState(context);
  }, []);

  // Extract accent color whenever backdrop URL changes
  useEffect(() => {
    if (!backdropUrl) {
      setAccentColor(undefined);
      extractionRef.current = undefined;
      return;
    }
    if (extractionRef.current === backdropUrl) return;
    extractionRef.current = backdropUrl;

    extractAccentColor(backdropUrl).then((color) => {
      // Only apply if this URL is still current
      if (extractionRef.current === backdropUrl) {
        setAccentColor(color);
      }
    });
  }, [backdropUrl]);

  const currentImageSource = useMemo<ImageSource | undefined>(() => {
    if (backdropUrl) {
      return { uri: backdropUrl };
    }
    return AMBIENT_BACKGROUNDS[screenContext];
  }, [backdropUrl, screenContext]);

  const value = useMemo(
    () => ({ setBackdropUrl, setScreenContext, currentImageSource, accentColor }),
    [setBackdropUrl, setScreenContext, currentImageSource, accentColor],
  );

  return <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>;
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error("useBackground must be used within a BackgroundProvider");
  }
  return context;
}
