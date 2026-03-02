import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type ScreenContext = "home" | "movies" | "tvshows" | "search" | "settings" | "continueWatching";
export type ImageSource = { uri: string } | number;

interface BackgroundContextType {
  setBackdropUrl: (url: string | undefined) => void;
  setScreenContext: (context: ScreenContext) => void;
  currentImageSource: ImageSource | undefined;
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

  const setBackdropUrl = useCallback((url: string | undefined) => {
    setBackdropUrlState(url);
  }, []);

  const setScreenContext = useCallback((context: ScreenContext) => {
    setScreenContextState(context);
  }, []);

  const currentImageSource = useMemo<ImageSource | undefined>(() => {
    if (backdropUrl) {
      return { uri: backdropUrl };
    }
    return AMBIENT_BACKGROUNDS[screenContext];
  }, [backdropUrl, screenContext]);

  const value = useMemo(
    () => ({ setBackdropUrl, setScreenContext, currentImageSource }),
    [setBackdropUrl, setScreenContext, currentImageSource],
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
