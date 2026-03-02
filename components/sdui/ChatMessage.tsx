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
  default: '#FFC312',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
};

const TV = Platform.isTV;

export function ChatMessage({ text, role = 'assistant', variant = 'default' }: ChatMessageProps) {
  const accentColor = ACCENT_COLORS[variant];
  const label = role === 'system' ? 'System' : 'Radbot';

  return (
    <View style={styles.container}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <Text style={[styles.roleLabel, { color: accentColor }]}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: TV ? 16 : 12,
    overflow: 'hidden',
    maxWidth: TV ? 1200 : undefined,
    alignSelf: 'flex-start',
    width: '100%',
  },
  accentBar: {
    width: TV ? 4 : 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: TV ? 32 : 20,
    paddingVertical: TV ? 28 : 16,
    gap: TV ? 10 : 6,
  },
  roleLabel: {
    fontSize: TV ? 20 : 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  text: {
    color: '#E5E5EA',
    fontSize: TV ? 26 : 17,
    lineHeight: TV ? 40 : 26,
    fontWeight: '400',
  },
});
