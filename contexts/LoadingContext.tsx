import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';

interface LoadingContextType {
  showGlobalLoader: () => void;
  hideGlobalLoader: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const showGlobalLoader = () => {
    setIsLoading(true);
  };

  const hideGlobalLoader = () => {
    setIsLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ showGlobalLoader, hideGlobalLoader, isLoading }}>
      {children}
      <Modal
        visible={isLoading}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
      >
        <View style={styles.globalLoader}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </Modal>
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  globalLoader: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
