/**
 * Registers all built-in SDUI components with the ComponentRegistry.
 * Import this module once at app startup (in _layout.tsx) to make all components
 * available for LLM-driven rendering via `tommo ui:render`.
 */
import { componentRegistry } from '@/services/componentRegistry';
import { Toast, toastPropsSchema } from './Toast';
import { TextMessage, textMessagePropsSchema } from './TextMessage';
import { NowPlayingCard, nowPlayingCardPropsSchema } from './NowPlayingCard';
import { MovieGrid, movieGridPropsSchema } from './MovieGrid';
import { SearchResults, searchResultsPropsSchema } from './SearchResults';
import { MediaGrid, mediaGridPropsSchema } from './MediaGrid';

componentRegistry.register({
  name: 'Toast',
  description: 'Overlay toast notification. Displays a brief text message on screen. Use for simple announcements, confirmations, or alerts. Renders as overlay — does not navigate to AI tab.',
  component: Toast,
  propsSchema: toastPropsSchema,
});

componentRegistry.register({
  name: 'TextMessage',
  description: '@deprecated — use Toast instead. Backward-compatible alias kept for existing bot prompts.',
  component: TextMessage,
  propsSchema: textMessagePropsSchema,
});

componentRegistry.register({
  name: 'NowPlayingCard',
  description: 'Rich now-playing card showing title, series info, poster art, progress bar, and playback position. Use when the user asks what is playing.',
  component: NowPlayingCard,
  propsSchema: nowPlayingCardPropsSchema,
});

componentRegistry.register({
  name: 'MovieGrid',
  description: 'Focusable poster grid for displaying a curated list of movies or shows. Each item is selectable to start playback. Use for "show me X movies" requests.',
  component: MovieGrid,
  propsSchema: movieGridPropsSchema,
  focusConfig: { focusDirection: 'grid' },
});

componentRegistry.register({
  name: 'SearchResults',
  description: 'Scrollable list of mixed media search results (movies, shows, episodes). Supports thumbnails and metadata. Use after a library search.',
  component: SearchResults,
  propsSchema: searchResultsPropsSchema,
  focusConfig: { focusDirection: 'vertical' },
});

componentRegistry.register({
  name: 'MediaGrid',
  description: 'Focusable poster grid for displaying Jellyfin video items. Consolidates movie grid and search results into one reusable component. Use for any list of media items the user should browse and select. Pass full Jellyfin item objects in the items array.',
  component: MediaGrid,
  propsSchema: mediaGridPropsSchema,
  focusConfig: { focusDirection: 'grid' },
});
