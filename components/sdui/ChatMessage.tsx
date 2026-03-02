import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

export const chatMessagePropsSchema = z.object({
  text: z.string().describe('The message text to display'),
  role: z.enum(['assistant', 'system']).default('assistant').describe('Who sent the message'),
  variant: z.enum(['default', 'success', 'warning', 'error']).default('default').describe('Visual style of the message'),
});

export type ChatMessageProps = z.infer<typeof chatMessagePropsSchema>;

const ACCENT_COLORS: Record<NonNullable<ChatMessageProps['variant']>, string> = {
  default: '#636366',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
};

const TV = Platform.isTV;

export function ChatMessage({ text, role = 'assistant', variant = 'default' }: ChatMessageProps) {
  const accentColor = ACCENT_COLORS[variant];
  const label = role === 'system' ? 'System' : 'Radbot';

  return (
    <View style={[styles.container, { borderLeftColor: accentColor }]}>
      <Text style={[styles.roleLabel, { color: accentColor }]}>{label}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderLeftWidth: 3,
    paddingHorizontal: TV ? 32 : 20,
    paddingVertical: TV ? 24 : 16,
    gap: TV ? 8 : 6,
  },
  roleLabel: {
    fontSize: TV ? 18 : 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  text: {
    color: '#FFFFFF',
    fontSize: TV ? 24 : 17,
    lineHeight: TV ? 36 : 26,
  },
});
