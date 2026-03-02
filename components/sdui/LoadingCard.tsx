import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { AnimatedProgressBar } from './AnimatedProgressBar';

import { remoteBridgeService } from '@/services/remoteBridgeService';

export const loadingCardPropsSchema = z.object({
  title: z.string().describe('Loading state description, e.g. "Searching Sonarr..."'),
  subtitle: z.string().optional().describe('Additional context, e.g. the search term'),
  progress: z.number().min(0).max(1).optional().describe('Progress 0–1 for a determinate bar. Omit for indeterminate spinner.'),
  estimatedDurationSeconds: z.number().positive().optional().describe(
    'If provided, animates the determinate progress bar from `progress` to 100% over this many seconds. Requires `progress` to be set.',
  ),
  cancellable: z.boolean().default(false).describe('Show a Cancel button that emits event.ui.action actionId=cancel'),
  component: z.string().default('LoadingCard').describe('Component name for event routing'),
});

export type LoadingCardProps = z.infer<typeof loadingCardPropsSchema>;

const TV = Platform.isTV;

export function LoadingCard({
  title,
  subtitle,
  progress,
  estimatedDurationSeconds,
  cancellable = false,
  component = 'LoadingCard',
}: LoadingCardProps) {
  const [cancelFocused, setCancelFocused] = useState(false);
  const hasDeterminateBar = typeof progress === 'number';

  const handleCancel = () => {
    remoteBridgeService.emitUiAction({ component, actionId: 'cancel' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {!hasDeterminateBar && (
          <ActivityIndicator size={TV ? 'large' : 'small'} color="#FFC312" />
        )}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {hasDeterminateBar && (
        <AnimatedProgressBar
          progress={progress!}
          durationToCompleteSeconds={estimatedDurationSeconds}
        />
      )}

      {cancellable && (
        <TouchableOpacity
          style={[styles.cancelBtn, cancelFocused && styles.cancelBtnFocused]}
          onPress={handleCancel}
          onFocus={() => setCancelFocused(true)}
          onBlur={() => setCancelFocused(false)}
          isTVSelectable
          activeOpacity={0.8}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: TV ? 24 : 16,
    padding: TV ? 48 : 24,
    gap: TV ? 28 : 16,
    maxWidth: TV ? 900 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 28 : 16,
  },
  textBlock: {
    flex: 1,
    gap: TV ? 8 : 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 32 : 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: TV ? 24 : 15,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: TV ? 18 : 10,
    paddingHorizontal: TV ? 52 : 28,
    borderRadius: TV ? 14 : 10,
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cancelBtnFocused: {
    borderColor: '#FFC312',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: TV ? 26 : 16,
    fontWeight: '600',
  },
});
