import { requireNativeView } from "expo-modules-core";
import { ViewStyle, Platform } from "react-native";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface TvosSearchViewProps {
  results: SearchResult[];
  columns?: number;
  placeholder?: string;
  onSearch: (event: { nativeEvent: { query: string } }) => void;
  onSelectItem: (event: { nativeEvent: { id: string } }) => void;
  style?: ViewStyle;
}

const NativeView =
  Platform.OS === "ios" || Platform.isTV
    ? requireNativeView<TvosSearchViewProps>("ExpoTvosSearch")
    : null;

export function TvosSearchView(props: TvosSearchViewProps) {
  if (!NativeView) {
    return null;
  }
  return <NativeView {...props} />;
}

export function isNativeSearchAvailable(): boolean {
  return Platform.isTV && Platform.OS === "ios";
}
