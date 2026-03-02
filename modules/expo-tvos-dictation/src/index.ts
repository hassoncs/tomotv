import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { ViewProps } from 'react-native';

export type ExpoTvosDictationViewProps = {
  text?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  textColor?: string;
  onTextChange?: (event: { nativeEvent: { text: string } }) => void;
  onSubmit?: (event: { nativeEvent: { text: string } }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
} & ViewProps;

const NativeView: React.ComponentType<ExpoTvosDictationViewProps> =
  requireNativeViewManager('ExpoTvosDictation');

export function ExpoTvosDictationView(props: ExpoTvosDictationViewProps) {
  return <NativeView {...props} />;
}
