import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SmartGlassView } from '@/components/SmartGlassView';
import { remoteBridgeService } from '@/services/remoteBridgeService';
import { ExpoTvosDictationView } from 'expo-tvos-dictation';
import { Ionicons } from '@expo/vector-icons';
import { SmartGlassView } from '@/components/SmartGlassView';
import { remoteBridgeService } from '@/services/remoteBridgeService';

import { componentRegistry } from '@/services/componentRegistry';
import type { SduiRenderPayload } from '@/services/componentRegistry';
import { logger } from '@/utils/logger';

interface RenderedComponent {
  id: string;
  element: React.ReactElement;
}

let nextId = 0;

const TV = Platform.isTV;

interface StatusRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  statusColor: string;
}

const STATUS_ROWS: StatusRow[] = [
  { icon: 'wifi', label: 'Home Assistant', value: '—', statusColor: '#8E8E93' },
  { icon: 'bulb-outline', label: 'Lights', value: '—', statusColor: '#8E8E93' },
  { icon: 'thermometer-outline', label: 'Climate', value: '—', statusColor: '#8E8E93' },
  { icon: 'musical-notes-outline', label: 'Speakers', value: '—', statusColor: '#8E8E93' },
  { icon: 'tv-outline', label: 'Apple TV', value: '—', statusColor: '#8E8E93' },
];

interface QuickActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  { icon: 'moon-outline', label: 'Goodnight' },
  { icon: 'sunny-outline', label: 'Good Morning' },
  { icon: 'film-outline', label: 'Cinema Mode' },
  { icon: 'home-outline', label: 'Away' },
];
/** AI tab — SDUI canvas host for rich content (MediaGrid, ConfirmationCard, InfoCard, etc.). */
export default function AiScreen() {
  const [components, setComponents] = useState<RenderedComponent[]>([]);
  const [command, setCommand] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleCommandSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    remoteBridgeService.sendNotification('input.text', { text: trimmed });
    setCommand('');
  };
  const handleRender = useCallback((payload: SduiRenderPayload) => {
    if (payload.target !== 'canvas') return;
    logger.info('AI tab: rendering canvas component', { service: 'AiScreen', name: payload.name });
    const element = componentRegistry.render(payload.name, payload.props);
    if (!element) {
      logger.warn('AI tab: render returned null', { service: 'AiScreen', name: payload.name });
      return;
    }
    const id = String(nextId++);
    setComponents((prev) => [...prev, { id, element }]);
  }, []);

  useEffect(() => {
    // Drain any canvas renders that arrived before this screen mounted
    const pending = componentRegistry.drainPending();
    if (pending.length > 0) {
      pending.forEach((payload) => handleRender(payload));
    }
    const unsub = componentRegistry.onRender(handleRender);
    return unsub;
  }, [handleRender]);

  if (components.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          focusable={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="home" size={TV ? 48 : 32} color="#FFC312" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Radbot</Text>
              <Text style={styles.headerSubtitle}>Home Assistant</Text>
            </View>
          </View>

          {/* Voice Command Input */}
          <View style={styles.commandContainer}>
            <SmartGlassView effect="clear" style={[styles.commandInputWrapper, isInputFocused && styles.commandInputWrapperFocused]}>
              <ExpoTvosDictationView
                placeholder="Hold Siri button to speak a command"
                placeholderTextColor="#A1A1A6"
                textColor="#FFFFFF"
                text={command}
                onTextChange={(e) => setCommand(e.nativeEvent.text)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onSubmit={(e) => handleCommandSubmit(e.nativeEvent.text)}
                style={styles.commandInput}
              />
              <Ionicons
                name="mic"
                size={TV ? 28 : 20}
                color={isInputFocused ? '#FFC312' : 'rgba(255, 255, 255, 0.3)'}
                style={styles.micIcon}
              />
            </SmartGlassView>
          </View>
          </View>

          {/* Status Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SYSTEM STATUS</Text>
          </View>

          <View style={styles.card}>
            {STATUS_ROWS.map((row, index) => (
              <View
                key={row.label}
                style={[styles.statusRow, index < STATUS_ROWS.length - 1 && styles.statusRowBorder]}
              >
                <View style={styles.statusLeft}>
                  <Ionicons name={row.icon} size={TV ? 24 : 18} color="#8E8E93" />
                  <Text style={styles.statusLabel}>{row.label}</Text>
                </View>
                <View style={styles.statusRight}>
                  <View style={[styles.statusDot, { backgroundColor: row.statusColor }]} />
                  <Text style={styles.statusValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Quick Actions Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          </View>

          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <View key={action.label} style={styles.actionCard}>
                <Ionicons name={action.icon} size={TV ? 32 : 22} color="#FFC312" />
                <Text style={styles.actionLabel}>{action.label}</Text>
              </View>
            ))}
          </View>

          {/* Placeholder notice */}
          <View style={styles.notice}>
            <Ionicons name="construct-outline" size={TV ? 20 : 14} color="#48484A" />
            <Text style={styles.noticeText}>Home Assistant integration coming soon</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.canvas}>
      {components.map((rc) => (
        <View key={rc.id} style={styles.componentWrapper}>
          {rc.element}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    gap: 16,
    padding: 64,
  },
  emptyIcon: {
    fontSize: 72,
    color: '#FFC312',
  },
  emptyTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 28,
    color: '#98989D',
    textAlign: 'center',
    maxWidth: 800,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    padding: 48,
    gap: 24,
  },
  componentWrapper: {
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },
  glowTopRight: {
    position: 'absolute',
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(255, 195, 18, 0.05)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -300,
    left: -200,
    width: 700,
    height: 700,
    borderRadius: 350,
    backgroundColor: 'rgba(10, 132, 255, 0.04)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: TV ? 100 : 48,
    paddingTop: TV ? 80 : 48,
    paddingBottom: TV ? 120 : 80,
    maxWidth: TV ? 1000 : 600,
    alignSelf: 'center',
    width: '100%',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 28 : 18,
    marginBottom: TV ? 40 : 28,
  },
  headerIcon: {
    width: TV ? 88 : 60,
    height: TV ? 88 : 60,
    borderRadius: TV ? 44 : 30,
    backgroundColor: 'rgba(255, 195, 18, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 195, 18, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TV ? 56 : 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  headerSubtitle: {
    fontSize: TV ? 22 : 15,
    fontWeight: '500',
    color: '#6E6E73',
    marginTop: TV ? 4 : 2,
  },
  // Command Input
  commandContainer: {
    marginBottom: TV ? 60 : 40,
  },
  commandInputWrapper: {
    width: '100%',
    borderRadius: TV ? 28 : 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: TV ? 28 : 20,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  commandInputWrapperFocused: {
    borderColor: '#FFC312',
    backgroundColor: 'rgba(255, 195, 18, 0.08)',
  },
  commandInput: {
    flex: 1,
    minHeight: TV ? 64 : 50,
    backgroundColor: 'transparent',
    paddingHorizontal: TV ? 28 : 20,
    fontSize: TV ? 28 : 20,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  micIcon: {
    marginLeft: 16,
  },
  // Section headers
  sectionHeader: {
    paddingHorizontal: TV ? 4 : 2,
    paddingBottom: TV ? 14 : 10,
    paddingTop: TV ? 8 : 4,
  },
  sectionLabel: {
    fontSize: TV ? 14 : 11,
    fontWeight: '700',
    color: '#48484A',
    letterSpacing: 2,
  },
  // Status card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: TV ? 20 : 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: TV ? 48 : 32,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: TV ? 28 : 18,
    paddingVertical: TV ? 20 : 14,
  },
  statusRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 16 : 10,
  },
  statusLabel: {
    fontSize: TV ? 22 : 15,
    fontWeight: '500',
    color: '#EBEBF5',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 10 : 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusValue: {
    fontSize: TV ? 20 : 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  // Quick actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TV ? 16 : 10,
    marginBottom: TV ? 60 : 40,
  },
  actionCard: {
    flex: 1,
    minWidth: TV ? 180 : 120,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: TV ? 18 : 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: TV ? 28 : 18,
    paddingHorizontal: TV ? 20 : 14,
    alignItems: 'center',
    gap: TV ? 12 : 8,
  },
  actionLabel: {
    fontSize: TV ? 18 : 12,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Notice
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TV ? 10 : 6,
  },
  noticeText: {
    fontSize: TV ? 16 : 11,
    color: '#48484A',
    fontWeight: '500',
  },
});
