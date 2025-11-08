// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock expo-video
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: 'VideoView'
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
