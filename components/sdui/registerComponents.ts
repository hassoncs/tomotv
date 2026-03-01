/**
 * Registers all built-in SDUI components with the ComponentRegistry.
 * Import this module once at app startup (in sdui.tsx) to make all components
 * available for LLM-driven rendering via `tommo ui:render`.
 */
import { componentRegistry } from '@/services/componentRegistry';
import { TextMessage, textMessagePropsSchema } from './TextMessage';
import { NowPlayingCard, nowPlayingCardPropsSchema } from './NowPlayingCard';
import { MovieGrid, movieGridPropsSchema } from './MovieGrid';
import { SearchResults, searchResultsPropsSchema } from './SearchResults';

componentRegistry.register({
  name: 'TextMessage',
  description: 'Displays a text notification or status message on screen. Use for simple announcements, confirmations, or alerts.',
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
