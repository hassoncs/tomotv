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
import { ConfirmationCard, confirmationCardPropsSchema } from './ConfirmationCard';
import { InfoCard, infoCardPropsSchema } from './InfoCard';
import { EpisodeList, episodeListPropsSchema } from './EpisodeList';

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

componentRegistry.register({
  name: 'ConfirmationCard',
  description: 'Modal-style card with confirm and cancel buttons. Emits event.ui.action with actionId "confirm" or "cancel". Use when the bot needs explicit user approval before an irreversible action.',
  component: ConfirmationCard,
  propsSchema: confirmationCardPropsSchema,
  focusConfig: { focusDirection: 'horizontal' },
});

componentRegistry.register({
  name: 'InfoCard',
  description: 'Rich info card with title, body text, optional image, and action buttons. Use to display metadata about a show, movie, or any rich content. Buttons emit event.ui.action.',
  component: InfoCard,
  propsSchema: infoCardPropsSchema,
  focusConfig: { focusDirection: 'vertical' },
});

componentRegistry.register({
  name: 'EpisodeList',
  description: 'Scrollable list of TV episodes with season/episode labels. Pressing an episode emits event.ui.select with the episode Jellyfin ID. Use after fetching episodes for a series.',
  component: EpisodeList,
  propsSchema: episodeListPropsSchema,
  focusConfig: { focusDirection: 'vertical' },
});
