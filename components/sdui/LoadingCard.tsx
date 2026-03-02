import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { remoteBridgeService } from '@/services/remoteBridgeService';

export const loadingCardPropsSchema = z.object({
  title: z.string().describe('Loading state description, e.g. "Searching Sonarr..."'),
  subtitle: z.string().optional().describe('Additional context, e.g. the search term'),
  progress: z.number().min(0).max(1).optional().describe('Progress 0–1 for a determinate bar. Omit for indeterminate spinner.'),
  cancellable: z.boolean().default(false).describe('Show a Cancel button that emits event.ui.action actionId=cancel'),
  component: z.string().default('LoadingCard').describe('Component name for event routing'),
});

export type LoadingCardProps = z.infer<typeof loadingCardPropsSchema>;

const TV = Platform.isTV;

export function LoadingCard({
  title,
  subtitle,
  progress,
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
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress! * 100)}%` as `${number}%` }]} />
        </View>
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
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: TV ? 40 : 24,
    gap: TV ? 24 : 16,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 24 : 16,
  },
  textBlock: {
    flex: 1,
    gap: TV ? 8 : 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 30 : 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: TV ? 22 : 15,
  },
  progressTrack: {
    height: TV ? 6 : 4,
    backgroundColor: '#3A3A3C',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFC312',
    borderRadius: 3,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: TV ? 16 : 10,
    paddingHorizontal: TV ? 48 : 28,
    borderRadius: 12,
    backgroundColor: '#3A3A3C',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cancelBtnFocused: {
    borderColor: '#FFC312',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: TV ? 24 : 16,
    fontWeight: '600',
  },
});
