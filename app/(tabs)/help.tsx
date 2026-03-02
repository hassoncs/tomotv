/**
 * @deprecated This tab has been replaced by the AI tab (ai.tsx).
 * File kept to avoid breaking any deep-link routes that may reference it.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HelpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This screen has been replaced by the AI tab.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  text: {
    color: '#98989D',
    fontSize: 24,
  },
});
