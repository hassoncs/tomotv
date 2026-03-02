import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { z } from 'zod';

export const toastPropsSchema = z.object({
  text: z.string().describe('Message text to display on screen'),
  style: z.enum(['info', 'success', 'warning', 'error']).default('info').describe('Visual style of the message'),
  duration: z.number().default(5).describe('Auto-dismiss after N seconds. 0 = persistent'),
});

export type ToastProps = z.infer<typeof toastPropsSchema>;

const BORDER_COLORS: Record<ToastProps['style'], string> = {
  info: '#007AFF',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
};

export function Toast({ text, style = 'info' }: ToastProps) {
  const borderColor = BORDER_COLORS[style];

  return (
    <View style={[styles.container, { borderLeftColor: borderColor }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 20,
    maxWidth: 800,
    alignSelf: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '500',
  },
});
