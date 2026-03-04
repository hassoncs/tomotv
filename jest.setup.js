// Polyfill structuredClone for older Node versions
// Standard Web API - proper polyfill pattern
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// WORKAROUND: Mock Expo's winter runtime globals for Jest
// Expo 54+ uses a "winter" module system that requires these globals
// This is a temporary hack until Expo provides official Jest support
// See: https://github.com/expo/expo/tree/main/packages/expo/src/winter
global.__ExpoImportMetaRegistry = {};

// Mock @expo/metro-runtime to prevent native runtime from loading in Node
jest.mock('@expo/metro-runtime', () => ({}));

// Mock @callstack/liquid-glass (ESM native module — unavailable in Jest)
jest.mock('@callstack/liquid-glass', () => ({
  LiquidGlassView: 'View',
  isLiquidGlassSupported: () => false,
}));

// Mock @shopify/react-native-skia (native Metal module — unavailable in Jest)
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Fill: 'Fill',
  Shader: 'Shader',
  Skia: {
    RuntimeEffect: {
      Make: () => ({}),
    },
  },
}));

// Mock expo-image (native module unavailable in Jest)
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock react-native-reanimated (native worklets fail in Jest environment)
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock VideoGridItem — complex native component with reanimated/expo-image/SmartGlass deps
jest.mock('@/components/video-grid-item', () => ({
  VideoGridItem: ({ video, onPress, index }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    const React = require('react');
    return React.createElement(TouchableOpacity, {
      testID: `card-${video.Id}`,
      onPress: () => onPress(video),
    }, React.createElement(Text, null, video.Name));
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock react-native-video
jest.mock('react-native-video', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    return null; // Mock Video component
  });
});

// Mock expo-router to prevent loading app structure
jest.mock('expo-router', () => ({
  Stack: 'Stack',
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock InteractionManager - must happen before React Native imports
jest.doMock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: jest.fn((callback) => {
    // Execute callback immediately in tests
    if (callback) callback();
    return { cancel: jest.fn() };
  }),
  createInteractionHandle: jest.fn(),
  clearInteractionHandle: jest.fn()
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
