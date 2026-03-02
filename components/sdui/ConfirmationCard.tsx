import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { remoteBridgeService } from '@/services/remoteBridgeService';

export const confirmationCardPropsSchema = z.object({
  title: z.string().describe('Confirmation prompt shown to the user'),
  message: z.string().optional().describe('Optional supporting detail text'),
  confirmLabel: z.string().default('Confirm').describe('Label for the confirm button'),
  cancelLabel: z.string().default('Cancel').describe('Label for the cancel button'),
  component: z.string().default('ConfirmationCard').describe('Component name for event routing'),
});

export type ConfirmationCardProps = z.infer<typeof confirmationCardPropsSchema>;

export function ConfirmationCard({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  component = 'ConfirmationCard',
}: ConfirmationCardProps) {
  const [focusedBtn, setFocusedBtn] = useState<'confirm' | 'cancel' | null>(null);

  const handleConfirm = () => {
    remoteBridgeService.emitUiAction({ component, actionId: 'confirm' });
  };

  const handleCancel = () => {
    remoteBridgeService.emitUiAction({ component, actionId: 'cancel' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.confirmBtn, focusedBtn === 'confirm' && styles.btnFocused]}
          onPress={handleConfirm}
          onFocus={() => setFocusedBtn('confirm')}
          onBlur={() => setFocusedBtn(null)}
          isTVSelectable
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>{confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn, focusedBtn === 'cancel' && styles.btnFocused]}
          onPress={handleCancel}
          onFocus={() => setFocusedBtn('cancel')}
          onBlur={() => setFocusedBtn(null)}
          isTVSelectable
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const TV = Platform.isTV;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28,28,30,0.97)',
    borderRadius: 20,
    padding: TV ? 48 : 32,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    gap: TV ? 32 : 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 40 : 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#98989D',
    fontSize: TV ? 28 : 18,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'center',
  },
  btn: {
    paddingVertical: TV ? 20 : 14,
    paddingHorizontal: TV ? 56 : 36,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  confirmBtn: {
    backgroundColor: '#FFC312',
  },
  cancelBtn: {
    backgroundColor: '#3A3A3C',
  },
  btnFocused: {
    borderColor: '#FFFFFF',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: TV ? 28 : 18,
    fontWeight: '700',
  },
});
