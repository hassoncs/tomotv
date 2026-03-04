/**
 * Registers all built-in SDUI components with the ComponentRegistry.
 * Import this module once at app startup (in _layout.tsx) to make all components
 * available for LLM-driven rendering via `radmedia ui:render`.
 */
import { componentRegistry } from "@/services/componentRegistry";
import { NowPlayingCard, nowPlayingCardPropsSchema } from "./NowPlayingCard";
import { SearchResults, searchResultsPropsSchema } from "./SearchResults";
import { MediaGrid, mediaGridPropsSchema } from "./MediaGrid";
import { ConfirmationCard, confirmationCardPropsSchema } from "./ConfirmationCard";
import { InfoCard, infoCardPropsSchema } from "./InfoCard";
import { EpisodeList, episodeListPropsSchema } from "./EpisodeList";
import { ChatMessage, chatMessagePropsSchema } from "./ChatMessage";
import { LoadingCard, loadingCardPropsSchema } from "./LoadingCard";
import { SeriesDetail, seriesDetailPropsSchema } from "./SeriesDetail";
import { TaskList, taskListPropsSchema } from "./TaskList";
componentRegistry.register({
  name: "NowPlayingCard",
  description: "Rich now-playing card showing title, series info, poster art, progress bar, and playback position. Use when the user asks what is playing.",
  component: NowPlayingCard,
  propsSchema: nowPlayingCardPropsSchema,
});

componentRegistry.register({
  name: "SearchResults",
  description: "Scrollable list of mixed media search results (movies, shows, episodes). Supports thumbnails and metadata. Use after a library search.",
  component: SearchResults,
  propsSchema: searchResultsPropsSchema,
  focusConfig: { focusDirection: "vertical" },
});

componentRegistry.register({
  name: "MediaGrid",
  description:
    "Focusable poster grid for displaying Jellyfin video items. Consolidates movie grid and search results into one reusable component. Use for any list of media items the user should browse and select. Pass full Jellyfin item objects in the items array.",
  component: MediaGrid,
  propsSchema: mediaGridPropsSchema,
  focusConfig: { focusDirection: "grid" },
});

componentRegistry.register({
  name: "ConfirmationCard",
  description:
    'Modal-style card with confirm and cancel buttons. Emits event.ui.action with actionId "confirm" or "cancel". Use when the bot needs explicit user approval before an irreversible action.',
  component: ConfirmationCard,
  propsSchema: confirmationCardPropsSchema,
  focusConfig: { focusDirection: "horizontal" },
});

componentRegistry.register({
  name: "InfoCard",
  description: "Rich info card with title, body text, optional image, and action buttons. Use to display metadata about a show, movie, or any rich content. Buttons emit event.ui.action.",
  component: InfoCard,
  propsSchema: infoCardPropsSchema,
  focusConfig: { focusDirection: "vertical" },
});

componentRegistry.register({
  name: "EpisodeList",
  description: "Scrollable list of TV episodes with season/episode labels. Pressing an episode emits event.ui.select with the episode Jellyfin ID. Use after fetching episodes for a series.",
  component: EpisodeList,
  propsSchema: episodeListPropsSchema,
  focusConfig: { focusDirection: "vertical" },
});

componentRegistry.register({
  name: "ChatMessage",
  description:
    "Display a conversational text response from the bot. Use for general Q&A answers, status updates, or any non-visual response where no richer component applies. Renders on the AI tab canvas.",
  component: ChatMessage,
  propsSchema: chatMessagePropsSchema,
});

componentRegistry.register({
  name: "LoadingCard",
  description: "Progress indicator for slow bot operations. Show this before a long seedbox search or multi-step action, then replace with a result component when done. Renders on the AI tab canvas.",
  component: LoadingCard,
  propsSchema: loadingCardPropsSchema,
});

componentRegistry.register({
  name: "SeriesDetail",
  description:
    "Rich series detail view showing poster, overview, and a season list. Selecting a season emits event.ui.select so the bot can follow up with an EpisodeList render. Use when the user asks about a specific TV series or clicks a Series item from MediaGrid.",
  component: SeriesDetail,
  propsSchema: seriesDetailPropsSchema,
  focusConfig: { focusDirection: "vertical" },
});

componentRegistry.register({
  name: "TaskList",
  description:
    "Agentic task checklist. Shows a live todo list with animated status icons and optional per-item progress bars. Use when executing multi-step plans so the user can see what the bot is working on. Re-render with the same task IDs to update statuses in place.",
  component: TaskList,
  propsSchema: taskListPropsSchema,
});
