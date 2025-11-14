import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";

interface LoadingContextType {
  showGlobalLoader: () => void;
  hideGlobalLoader: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showGlobalLoader = useCallback(() => {
    setIsLoading(true);
  }, []);

  const hideGlobalLoader = useCallback(() => {
    setIsLoading(false);
  }, []);

  const value = useMemo(() => ({ showGlobalLoader, hideGlobalLoader, isLoading }), [showGlobalLoader, hideGlobalLoader, isLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <Modal visible={isLoading} transparent={true} animationType="slide" statusBarTranslucent={true}>
        <View style={styles.globalLoader}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      </Modal>
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  globalLoader: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
});
