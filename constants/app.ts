/**
 * Shared application constants
 */

// Cache settings
export const CACHE = {
  /** Default TTL for cached data (5 minutes) */
  DEFAULT_TTL_MS: 5 * 60 * 1000,
} as const;

// Design system values
export const DESIGN = {
  /** Standard border radius for cards and grid items */
  BORDER_RADIUS_CARD: 32,
  /** Border radius for medium elements (settings rows, etc) */
  BORDER_RADIUS_MEDIUM: 12,
  /** Standard border radius for buttons */
  BORDER_RADIUS_BUTTON: 10,
  /** Standard border radius for inputs and small elements */
  BORDER_RADIUS_SMALL: 8,
  /** Fully circular elements */
  BORDER_RADIUS_ROUND: 999,
} as const;

// Color palette (matches CLAUDE.md design system)
export const COLORS = {
  BACKGROUND: '#1C1C1E',
  CARD: '#2C2C2E',
  CARD_FOCUSED: '#3A3A3C',
  PRIMARY: '#FFC312',
  SUCCESS: '#34C759',
  ERROR: '#FF3B30',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#8E8E93',
  TEXT_TERTIARY: '#636366',
} as const;
