import { JellyfinItem, JellyfinVideoItem, JellyfinVideosResponse, JellyfinFolderResponse } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { retryWithBackoff } from "@/utils/retry";
import * as SecureStore from "expo-secure-store";

// Development fallback credentials from .env.local
// These are ONLY used during local development if user hasn't configured settings
// Production builds will NOT include .env.local (it's in .gitignore)
// Users MUST configure their own server via Settings screen
const DEV_SERVER = process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER || "";
const DEV_API_KEY = process.env.EXPO_PUBLIC_DEV_JELLYFIN_API_KEY || "";
const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_JELLYFIN_USER_ID || "";

const STORAGE_KEYS = {
  SERVER_URL: "jellyfin_server_url",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality",
};

// Video quality presets (matches settings page)
const QUALITY_PRESETS = [
  { label: "480p", bitrate: 1500000, width: 854, height: 480 }, // Increased from 1Mbps
  { label: "540p", bitrate: 2500000, width: 960, height: 540 }, // Increased from 1.5Mbps
  { label: "720p", bitrate: 4000000, width: 1280, height: 720 }, // Increased from 3Mbps
  { label: "1080p", bitrate: 8000000, width: 1920, height: 1080 }, // Increased from 5Mbps
];

const DEFAULT_QUALITY = 0; // 480p

// Cached config for synchronous URL functions
// Will be populated from SecureStore on first load
let cachedConfig = {
  server: "",
  apiKey: "",
  userId: "",
};

/**
 * Get Jellyfin configuration from SecureStore
 * Falls back to .env.local development credentials if user hasn't configured settings
 * Also updates the cache for synchronous functions
 */
async function getConfig(): Promise<{
  server: string;
  apiKey: string;
  userId: string;
}> {
  try {
    // First, check if migration is needed (old format to new format)
    let [serverUrl, apiKey, userId, oldIp, oldPort, oldProtocol] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL),
      SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
      SecureStore.getItemAsync("jellyfin_server_ip"),
      SecureStore.getItemAsync("jellyfin_server_port"),
      SecureStore.getItemAsync("jellyfin_server_protocol"),
    ]);

    // Migrate old format to new format if needed
    if (!serverUrl && oldIp) {
      const protocol = oldProtocol || "http";
      const port = oldPort || "8096";
      const migratedUrl = `${protocol}://${oldIp}:${port}`;

      logger.info("Migrating old server config to new format", {
        service: "JellyfinAPI",
        oldIp,
        oldPort: port,
        oldProtocol: protocol,
        newUrl: migratedUrl,
      });

      await SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, migratedUrl);
      serverUrl = migratedUrl;

      // Clean up old keys
      await Promise.all([
        SecureStore.deleteItemAsync("jellyfin_server_ip").catch(() => {}),
        SecureStore.deleteItemAsync("jellyfin_server_port").catch(() => {}),
        SecureStore.deleteItemAsync("jellyfin_server_protocol").catch(() => {}),
      ]);
    }

    // Remove trailing slashes from server URL
    const cleanServerUrl = (serverUrl?.trim() || DEV_SERVER).replace(/\/+$/, "");

    const config = {
      // Use user settings if available, otherwise fall back to dev env vars
      server: cleanServerUrl,
      apiKey: apiKey?.trim() || DEV_API_KEY,
      userId: userId?.trim() || DEV_USER_ID,
    };

    // Update cache for synchronous functions
    cachedConfig = config;

    logger.debug("Config loaded", {
      service: "JellyfinAPI",
      hasStoredUrl: !!serverUrl,
      hasDevServer: !!DEV_SERVER,
      server: config.server,
      hasApiKey: !!config.apiKey,
      hasUserId: !!config.userId,
    });

    // Log when using dev credentials (helpful for debugging)
    if (!serverUrl && DEV_SERVER) {
      logger.debug("Using development credentials from .env.local", {
        service: "JellyfinAPI",
      });
    }

    return config;
  } catch (error) {
    logger.error("Error reading Jellyfin config from SecureStore", error, {
      service: "JellyfinAPI",
    });
    // Fall back to dev credentials on error
    return {
      server: DEV_SERVER,
      apiKey: DEV_API_KEY,
      userId: DEV_USER_ID,
    };
  }
}

/**
 * Refresh the config cache - call this after updating settings
 */
export async function refreshConfig(): Promise<void> {
  await getConfig();
}

/**
 * Sync dev environment variables to SecureStore if not already set
 * This ensures dev credentials are visible in SecureStore for debugging
 * Also handles migration from old storage format (IP/port/protocol) to new format (full URL)
 */
export async function syncDevCredentials(): Promise<void> {
  try {
    // First, check if we need to migrate old settings to new format
    const [existingUrl, existingIp, existingPort, existingProtocol] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL),
      SecureStore.getItemAsync("jellyfin_server_ip"),
      SecureStore.getItemAsync("jellyfin_server_port"),
      SecureStore.getItemAsync("jellyfin_server_protocol"),
    ]);

    // Migrate old format to new format if needed
    if (!existingUrl && existingIp) {
      const protocol = existingProtocol || "http";
      const port = existingPort || "8096";
      const migratedUrl = `${protocol}://${existingIp}:${port}`;

      logger.info("Migrating old server config to new format", {
        service: "JellyfinAPI",
        oldIp: existingIp,
        oldPort: port,
        oldProtocol: protocol,
        newUrl: migratedUrl,
      });

      await SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, migratedUrl);

      // Clean up old keys
      await Promise.all([
        SecureStore.deleteItemAsync("jellyfin_server_ip").catch(() => {}),
        SecureStore.deleteItemAsync("jellyfin_server_port").catch(() => {}),
        SecureStore.deleteItemAsync("jellyfin_server_protocol").catch(() => {}),
      ]);

      return; // Migration done, no need to sync dev credentials
    }

    // Only sync dev credentials if we have them
    if (!DEV_SERVER || !DEV_API_KEY || !DEV_USER_ID) {
      return;
    }

    // Always sync dev credentials when available (dev mode only)
    // In production builds, .env.local is not included so DEV_* values are empty
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, DEV_SERVER),
      SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, DEV_API_KEY),
      SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, DEV_USER_ID),
    ]);
    logger.debug("Synced dev credentials to SecureStore", {
      service: "JellyfinAPI",
    });
  } catch (error) {
    logger.error("Error syncing dev credentials", error, {
      service: "JellyfinAPI",
    });
  }
}

/**
 * Get video quality settings from SecureStore
 * Returns quality preset index (0-3) or default (540p)
 */
async function getQualitySettings(): Promise<{
  index: number;
  bitrate: number;
  width: number;
  height: number;
  label: string;
}> {
  try {
    const savedQuality = await SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY);
    const qualityIndex = savedQuality ? parseInt(savedQuality, 10) : DEFAULT_QUALITY;

    // Validate index is within bounds
    const validIndex = qualityIndex >= 0 && qualityIndex < QUALITY_PRESETS.length ? qualityIndex : DEFAULT_QUALITY;
    const preset = QUALITY_PRESETS[validIndex];

    return {
      index: validIndex,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label,
    };
  } catch (error) {
    logger.error("Error reading quality settings", error);
    const preset = QUALITY_PRESETS[DEFAULT_QUALITY];
    return {
      index: DEFAULT_QUALITY,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label,
    };
  }
}

// Initialize config cache on module load
getConfig().catch(() => {
  // Silent fail, will use defaults
});

/**
 * Fetch primary library/view name from Jellyfin
 * Returns the first Movie/Video library name found
 */
export async function fetchLibraryName(): Promise<string> {
  try {
    const config = await getConfig();

    if (!config.server || !config.apiKey || !config.userId) {
      return "LIBRARY";
    }

    return await retryWithBackoff(
      async () => {
        const url = `${config.server}/Users/${config.userId}/Views`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `MediaBrowser Token="${config.apiKey}"`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            logger.warn("Failed to fetch library name", {
              service: "JellyfinAPI",
              status: response.status,
            });
            return "LIBRARY";
          }

          const data = await response.json();

          // Debug: log the response
          logger.debug("Jellyfin Views response", {
            service: "JellyfinAPI",
            itemsCount: data.Items?.length || 0,
            items: data.Items?.map((item: any) => ({
              name: item.Name,
              collectionType: item.CollectionType,
            })),
          });

          // Find first Movie or mixed collection, or just any library with content
          let library = data.Items?.find((item: any) => item.CollectionType === "movies" || item.CollectionType === "mixed");

          // If no movie/mixed library, just use the first one
          if (!library && data.Items && data.Items.length > 0) {
            library = data.Items[0];
            logger.debug("Using first available library", {
              service: "JellyfinAPI",
              name: library.Name,
              collectionType: library.CollectionType,
            });
          }

          if (library) {
            logger.debug("Found library", {
              service: "JellyfinAPI",
              name: library.Name,
              collectionType: library.CollectionType,
            });
          } else {
            logger.warn("No libraries found", {
              service: "JellyfinAPI",
            });
          }

          return library?.Name || "LIBRARY";
        } catch (error) {
          clearTimeout(timeoutId);
          logger.warn("Error fetching library name", error, {
            service: "JellyfinAPI",
          });
          return "LIBRARY";
        }
      },
      { maxAttempts: 2 },
    );
  } catch (error) {
    logger.warn("Error fetching library name", error, {
      service: "JellyfinAPI",
    });
    return "LIBRARY";
  }
}

/**
 * Fetch library videos with pagination support
 * Use this for incremental loading with infinite scroll
 */
export async function fetchLibraryVideos({ limit = 60, startIndex = 0 }: { limit?: number; startIndex?: number } = {}): Promise<{ items: JellyfinVideoItem[]; total?: number }> {
  const config = await getConfig();

  if (!config.server || !config.apiKey || !config.userId) {
    logger.error("Jellyfin server not configured", {
      service: "JellyfinAPI",
      hasServer: !!config.server,
      hasApiKey: !!config.apiKey,
      hasUserId: !!config.userId,
      server: config.server || "not set",
    });
    throw new Error("Jellyfin server not configured. Please go to Settings and configure your server connection.");
  }

  logger.debug("Fetching library videos", {
    service: "JellyfinAPI",
    server: config.server,
    limit,
    startIndex,
  });

  return retryWithBackoff(
    async () =>
      requestLibraryItems(config, {
        startIndex,
        limit,
        timeoutMs: 30000,
      }),
    { maxAttempts: 3 },
  );
}

/**
 * Fetch all videos from Jellyfin server
 * Loads all videos at once - use fetchLibraryVideos() for paginated loading
 * @deprecated Use fetchLibraryVideos() with pagination for better performance
 */
export async function fetchVideos(): Promise<JellyfinVideoItem[]> {
  try {
    const config = await getConfig();

    // Validate configuration before making request
    // This will only fail in production when user hasn't configured AND no dev credentials
    if (!config.server || !config.apiKey || !config.userId) {
      throw new Error("Jellyfin server not configured. Please go to Settings and configure your server connection.");
    }

    const pageSize = 200;
    const maxBatches = 50;
    const aggregated: JellyfinVideoItem[] = [];
    let startIndex = 0;
    let totalRecordCount: number | undefined;
    let batches = 0;

    while (batches < maxBatches) {
      batches += 1;
      const { items, total } = await retryWithBackoff(
        () =>
          requestLibraryItems(config, {
            startIndex,
            limit: pageSize,
          }),
        { maxAttempts: 3 },
      );

      totalRecordCount = total ?? totalRecordCount;
      aggregated.push(...items);

      if (items.length < pageSize) {
        break;
      }

      if (totalRecordCount !== undefined && aggregated.length >= totalRecordCount) {
        break;
      }

      startIndex += items.length;

      if (batches === maxBatches) {
        logger.warn("Reached library fetch batch limit", {
          service: "JellyfinAPI",
          fetched: aggregated.length,
        });
      }
    }

    return aggregated;
  } catch (error) {
    logger.error("Error fetching videos from Jellyfin", error, {
      service: "JellyfinAPI",
    });
    throw error;
  }
}

/**
 * Parse year(s) from search query
 * Supports patterns like:
 * - Full years: "2023", "action 2023", "(2020)"
 * - Year ranges: "2019-2023"
 * - Decades: "90s", "1990s", "80s"
 * - Partial years: "199" → 1990-1999, "20" → 2000-2009
 * Returns the remaining search term and extracted years
 */
function parseYearsFromQuery(query: string): { term: string; years: number[] } {
  const years: number[] = [];
  let term = query;

  // Pattern 1: Year range like "2019-2023" or "2019 - 2023"
  const rangeMatch = term.match(/\b(19|20)\d{2}\s*-\s*(19|20)\d{2}\b/);
  if (rangeMatch) {
    const [fullMatch] = rangeMatch;
    const [startYear, endYear] = fullMatch.split(/\s*-\s*/).map(Number);
    if (startYear <= endYear && endYear - startYear <= 10) {
      for (let y = startYear; y <= endYear; y++) {
        years.push(y);
      }
      term = term.replace(fullMatch, "").trim();
    }
  }

  // Pattern 2: Year in parentheses like "(2023)"
  const parenMatch = term.match(/\((\d{4})\)/);
  if (parenMatch && years.length === 0) {
    const year = parseInt(parenMatch[1], 10);
    if (year >= 1900 && year <= 2100) {
      years.push(year);
      term = term.replace(parenMatch[0], "").trim();
    }
  }

  // Pattern 3: Decade shorthand like "90s", "1990s", "80s"
  const decadeMatch = term.match(/\b(19)?(\d)0s\b/i);
  if (decadeMatch && years.length === 0) {
    const century = decadeMatch[1] ? 1900 : 2000;
    const decade = parseInt(decadeMatch[2], 10) * 10;
    // For "90s" without prefix, assume 1990s if >= 30, else 2000s
    const baseYear = decadeMatch[1] ? century + decade : (decade >= 30 ? 1900 + decade : 2000 + decade);
    for (let y = baseYear; y < baseYear + 10; y++) {
      years.push(y);
    }
    term = term.replace(decadeMatch[0], "").trim();
  }

  // Pattern 4: Standalone year at end like "action 2023"
  const endYearMatch = term.match(/\s+(19|20)\d{2}$/);
  if (endYearMatch && years.length === 0) {
    const year = parseInt(endYearMatch[0].trim(), 10);
    if (year >= 1900 && year <= 2100) {
      years.push(year);
      term = term.replace(endYearMatch[0], "").trim();
    }
  }

  // Pattern 5: Just a full 4-digit year by itself like "2023"
  if (years.length === 0 && /^(19|20)\d{2}$/.test(term.trim())) {
    years.push(parseInt(term.trim(), 10));
    term = "";
  }

  // Pattern 6: 3-digit partial year like "199" → 1990-1999, "202" → 2020-2029
  if (years.length === 0 && /^(19|20)\d$/.test(term.trim())) {
    const partial = term.trim();
    const baseYear = parseInt(partial + "0", 10);
    for (let y = baseYear; y < baseYear + 10; y++) {
      years.push(y);
    }
    term = "";
  }

  // Pattern 7: 2-digit century prefix like "19" → 1900-1999, "20" → 2000-2099
  if (years.length === 0 && /^(19|20)$/.test(term.trim())) {
    const century = parseInt(term.trim(), 10) * 100;
    // Limit to reasonable range to avoid too many years
    const currentYear = new Date().getFullYear();
    const endYear = Math.min(century + 99, currentYear + 5);
    for (let y = century; y <= endYear; y++) {
      years.push(y);
    }
    term = "";
  }

  return { term: term.trim(), years };
}

/**
 * Fetch episodes from a Series
 */
async function fetchSeriesEpisodes(config: JellyfinConfig, seriesId: string, limit: number = 50): Promise<JellyfinVideoItem[]> {
  const query = new URLSearchParams({
    ParentId: seriesId,
    Recursive: "true",
    IncludeItemTypes: "Episode",
    Fields: "Path,MediaStreams,Genres,ProductionYear,SeriesName",
    Limit: String(limit),
    SortBy: "SortName",
    SortOrder: "Ascending",
  });

  const url = `${config.server}/Users/${config.userId}/Items?${query.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `MediaBrowser Token="${config.apiKey}"`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data: JellyfinVideosResponse = await response.json();
    return data.Items || [];
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Remote search for videos using Jellyfin's SearchTerm filter
 * Supports searching by:
 * - Title/name (default)
 * - Path/folder name (via SearchTerm)
 * - Year: "action 2023", "(2020)", "2019-2023"
 * - Series name (automatically expands to episodes)
 */
export async function searchVideos(searchTerm: string, { limit = 60, startIndex = 0 }: { limit?: number; startIndex?: number } = {}): Promise<{ items: JellyfinVideoItem[]; total?: number }> {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return { items: [], total: 0 };
  }

  const config = await getConfig();
  if (!config.server || !config.apiKey || !config.userId) {
    throw new Error("Jellyfin server not configured. Update settings before searching.");
  }

  // Parse year from search query
  const { term, years } = parseYearsFromQuery(trimmed);

  logger.debug("Search query parsed", {
    service: "JellyfinAPI",
    originalQuery: trimmed,
    parsedTerm: term || "(empty)",
    parsedYears: years.length > 0 ? `${years[0]}${years.length > 1 ? `-${years[years.length - 1]}` : ""}` : "(none)",
    yearCount: years.length,
  });

  return retryWithBackoff(
    async () => {
      // First search: playable items + Series (to expand into episodes)
      const result = await requestLibraryItems(config, {
        startIndex,
        limit,
        searchTerm: term || undefined,
        years: years.length > 0 ? years : undefined,
        includeAllTypes: true,
        includeSeries: true, // Also search for Series to expand
        timeoutMs: 15000,
      });

      // Separate playable items from Series
      const playableItems: JellyfinVideoItem[] = [];
      const seriesItems: JellyfinVideoItem[] = [];

      for (const item of result.items) {
        if (item.Type === "Series") {
          seriesItems.push(item);
        } else {
          playableItems.push(item);
        }
      }

      // If we found Series, fetch their episodes
      if (seriesItems.length > 0) {
        logger.debug("Expanding series to episodes", {
          service: "JellyfinAPI",
          seriesCount: seriesItems.length,
          seriesNames: seriesItems.map((s) => s.Name).join(", "),
        });

        const episodePromises = seriesItems.map((series) => fetchSeriesEpisodes(config, series.Id, 20));
        const episodeResults = await Promise.all(episodePromises);

        for (const episodes of episodeResults) {
          playableItems.push(...episodes);
        }
      }

      return {
        items: playableItems,
        total: playableItems.length,
      };
    },
    { maxAttempts: 3 },
  );
}

/**
 * Check if item is a folder type
 */
export function isFolder(item: JellyfinItem): boolean {
  return (
    item.Type === "Folder" ||
    item.Type === "CollectionFolder" ||
    item.Type === "Series" ||
    item.Type === "Season" ||
    item.Type === "BoxSet" ||
    item.Type === "MusicAlbum" ||
    item.Type === "MusicArtist" ||
    item.Type === "PhotoAlbum"
  );
}

/**
 * Fetch user's library views (root libraries)
 * Returns the top-level folders like "Movies", "TV Shows", etc.
 */
export async function fetchUserViews(): Promise<{ items: JellyfinItem[]; total?: number }> {
  const config = await getConfig();

  if (!config.server || !config.apiKey || !config.userId) {
    throw new Error("Jellyfin server not configured.");
  }

  return retryWithBackoff(
    async () => {
      const url = `${config.server}/Users/${config.userId}/Views`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `MediaBrowser Token="${config.apiKey}"`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch views: ${response.status}`);
        }

        const data = await response.json();
        return {
          items: data.Items || [],
          total: data.TotalRecordCount,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    { maxAttempts: 3 },
  );
}

/**
 * Fetch contents of a folder by ParentId
 * Returns direct children only (folders and videos)
 *
 * @param parentId - The folder ID to fetch contents for (null for root views)
 * @param options - Pagination options
 */
export async function fetchFolderContents(
  parentId: string | null,
  { limit = 60, startIndex = 0 }: { limit?: number; startIndex?: number } = {},
): Promise<{ items: JellyfinItem[]; total?: number }> {
  // If no parentId, return user views (root level)
  if (!parentId) {
    return fetchUserViews();
  }

  const config = await getConfig();

  if (!config.server || !config.apiKey || !config.userId) {
    throw new Error("Jellyfin server not configured.");
  }

  return retryWithBackoff(
    async () => {
      const query = new URLSearchParams({
        ParentId: parentId,
        IncludeItemTypes: "Movie,Video,Folder,CollectionFolder,Series,Season,Episode,BoxSet,MusicAlbum,MusicArtist,PhotoAlbum",
        Fields: "Path,MediaStreams,Genres,ChildCount,ParentId",
        StartIndex: String(startIndex),
        Limit: String(limit),
        SortBy: "SortName",
        SortOrder: "Ascending",
      });

      const url = `${config.server}/Users/${config.userId}/Items?${query.toString()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `MediaBrowser Token="${config.apiKey}"`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch folder contents: ${response.status}`);
        }

        const data: JellyfinFolderResponse = await response.json();
        return {
          items: data.Items || [],
          total: data.TotalRecordCount,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    { maxAttempts: 3 },
  );
}

/**
 * Get thumbnail URL for a folder
 */
export function getFolderThumbnailUrl(itemId: string, maxHeight: number = 300): string {
  return `${cachedConfig.server}/Items/${itemId}/Images/Primary?api_key=${cachedConfig.apiKey}&maxHeight=${maxHeight}&quality=90`;
}

type JellyfinConfig = {
  server: string;
  apiKey: string;
  userId: string;
};

async function requestLibraryItems(
  config: JellyfinConfig,
  {
    startIndex = 0,
    limit = 200,
    searchTerm,
    years,
    includeAllTypes = false,
    includeSeries = false,
    timeoutMs = 30000,
  }: {
    startIndex?: number;
    limit?: number;
    searchTerm?: string;
    years?: number[];
    includeAllTypes?: boolean;
    includeSeries?: boolean;
    timeoutMs?: number;
  },
): Promise<{ items: JellyfinVideoItem[]; total?: number }> {
  // When searching, include all playable content types across all libraries
  // Only include directly playable items (not folders like Series/Season)
  // - Movie: standalone movies
  // - Video: generic video files
  // - Episode: TV show episodes (playable)
  // - Audio: music/audio tracks (playable)
  // - Series: only when includeSeries=true (will be expanded to episodes by caller)
  // Excluded: Season, MusicAlbum, MusicArtist (these are folders, not playable)
  let itemTypes = includeAllTypes ? "Movie,Video,Episode,Audio" : "Movie,Video";
  if (includeSeries) {
    itemTypes += ",Series";
  }

  const query = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: itemTypes,
    Fields: "Path,MediaStreams,Genres,ProductionYear",
    StartIndex: String(startIndex),
    Limit: String(limit),
    SortBy: "DateCreated",
    SortOrder: "Descending",
  });

  if (searchTerm) {
    query.append("SearchTerm", searchTerm);
  }

  if (years && years.length > 0) {
    query.append("Years", years.join(","));
  }

  const url = `${config.server}/Users/${config.userId}/Items?${query.toString()}`;

  logger.debug("Requesting library items", {
    service: "JellyfinAPI",
    url,
    server: config.server,
    userId: config.userId,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `MediaBrowser Token="${config.apiKey}"`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error("Failed to fetch videos", {
        service: "JellyfinAPI",
        status: response.status,
        statusText: response.statusText,
        url,
      });
      throw new Error(`Failed to fetch videos: ${response.status} ${response.statusText}`);
    }

    const data: JellyfinVideosResponse = await response.json();
    return {
      items: data.Items || [],
      total: data.TotalRecordCount,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please check your network connection and Jellyfin server.");
    }
    throw error;
  }
}

/**
 * Get video stream URL for a specific item
 * Always uses direct download - HLS generation appears broken in Jellyfin
 * @param itemId - The video item ID
 * @param videoItem - Optional video item (unused)
 */
export function getVideoStreamUrl(itemId: string, videoItem?: JellyfinVideoItem | null): string {
  // Use direct download endpoint with API key in URL
  return `${cachedConfig.server}/Items/${itemId}/Download?api_key=${cachedConfig.apiKey}`;
}

/**
 * Get HLS transcoding URL with configurable quality
 *
 * Uses master.m3u8 HLS endpoint with full H.264/AAC transcode.
 * Subtitles are burned into video frames using SubtitleMethod=Encode.
 * Quality settings are loaded from user preferences.
 *
 * Optimized for Apple TV with:
 * - Fast encoding preset (veryfast/superfast)
 * - Larger segments (10s) for reduced overhead
 * - Higher H.264 level (4.1) for better compression
 * - Hardware acceleration hints
 *
 * @param itemId - The video item ID
 * @param videoItem - Optional video item with MediaStreams for subtitle detection
 */
export async function getTranscodingStreamUrl(itemId: string, videoItem?: JellyfinVideoItem | null): Promise<string> {
  // Get user's quality preferences
  const quality = await getQualitySettings();

  // Use HLS master.m3u8 endpoint for transcoding
  let url =
    `${cachedConfig.server}/Videos/${itemId}/master.m3u8?` +
    `api_key=${cachedConfig.apiKey}` +
    `&MediaSourceId=${itemId}` +
    `&VideoCodec=h264` +
    `&AudioCodec=aac` +
    `&VideoBitrate=${quality.bitrate}` +
    `&AudioBitrate=192000` + // 192kbps (better for AAC)
    `&MaxWidth=${quality.width}` +
    `&MaxHeight=${quality.height}` +
    `&VideoLevel=41` + // H.264 level 4.1 (was 30)
    `&TranscodingMaxAudioChannels=2` +
    `&SegmentContainer=ts` +
    `&MinSegments=1` +
    `&SegmentLength=10` + // 10 second segments (was 8)
    `&BreakOnNonKeyFrames=false` + // Force keyframes at segment boundaries
    `&TranscodeReasons=VideoCodecNotSupported` + // Hint for hardware accel
    `&EnableAutoStreamCopy=false` + // Force transcode for consistency
    `&AllowVideoStreamCopy=false` + // Ensure predictable behavior
    `&RequireAvc=true`; // Force H.264/AVC output

  // Check for external subtitles and burn them in
  if (videoItem && videoItem.MediaStreams) {
    const subtitleStreams = videoItem.MediaStreams.filter((stream) => stream.Type === "Subtitle" && stream.IsExternal && stream.Index !== undefined);

    if (subtitleStreams.length > 0) {
      const firstSubIndex = subtitleStreams[0].Index;
      url += `&SubtitleStreamIndex=${firstSubIndex}`;
      url += `&SubtitleMethod=Encode`; // Burn subtitles into video frames
      logger.info("Transcoding with subtitle burn-in", {
        service: "JellyfinAPI",
        streamIndex: firstSubIndex,
        quality: quality.label,
        bitrate: `${quality.bitrate / 1000000}Mbps`,
      });
    } else {
      logger.info("Transcoding without subtitles", {
        service: "JellyfinAPI",
        quality: quality.label,
        bitrate: `${quality.bitrate / 1000000}Mbps`,
      });
    }
  }

  return url;
}

/**
 * Get poster image URL for a specific item
 * Posters are better for movie/video displays (2:3 aspect ratio)
 */
export function getPosterUrl(itemId: string, maxHeight: number = 450): string {
  return `${cachedConfig.server}/Items/${itemId}/Images/Primary?api_key=${cachedConfig.apiKey}&maxHeight=${maxHeight}&quality=90`;
}

/**
 * Check if item has a poster image
 */
export function hasPoster(item: JellyfinVideoItem): boolean {
  return item.ImageTags?.Primary !== undefined;
}

/**
 * Format duration from RunTimeTicks to readable format
 * RunTimeTicks are in 100-nanosecond intervals
 * @param ticks - RunTimeTicks from Jellyfin
 * @returns Formatted string like "1h 23m" or "45m"
 */
export function formatDuration(ticks: number): string {
  const totalSeconds = ticks / 10000000;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Fetch detailed video item information including media streams
 */
export async function fetchVideoDetails(itemId: string): Promise<JellyfinVideoItem | null> {
  try {
    const config = await getConfig();

    // Wrap the fetch operation with retry logic
    return await retryWithBackoff(
      async () => {
        const url = `${config.server}/Users/${config.userId}/Items/${itemId}?Fields=Path,MediaStreams,Overview,MediaSources`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `MediaBrowser Token="${config.apiKey}"`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch video details: ${response.status} ${response.statusText}`);
          }

          const data: JellyfinVideoItem = await response.json();
          return data;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Request timed out. Please check your network connection.");
          }
          throw error;
        }
      },
      { maxAttempts: 3 },
    );
  } catch (error) {
    logger.error("Error fetching video details from Jellyfin", error, {
      service: "JellyfinAPI",
    });
    return null;
  }
}

/**
 * Check if a video codec is natively supported on iOS/tvOS
 * iOS/tvOS native support:
 * - H.264 (AVC): Fully supported
 * - HEVC (H.265): Supported on A10+ devices (iPhone 7+, iPad 2017+, Apple TV 4K)
 *
 * NOT supported (requires transcoding):
 * - MPEG-4 Part 2: Old codec (DivX/Xvid), not supported
 * - VP8, VP9: Google codecs, not supported
 * - AV1: Not supported yet
 * - VC-1: Windows Media codec, not supported
 * - MPEG-2: Limited/no support
 * - DivX, Xvid: Not supported
 */
export function isCodecSupported(codec: string): boolean {
  const codecLower = codec.toLowerCase();

  // Supported codecs
  if (codecLower.includes("h264") || codecLower.includes("avc")) {
    return true; // H.264/AVC is universally supported
  }

  if (codecLower.includes("hevc") || codecLower.includes("h265")) {
    return true; // HEVC is supported on modern iOS/tvOS devices
  }

  // Unsupported codecs that need transcoding
  if (codecLower.includes("mpeg4") || codecLower.includes("mpeg-4")) {
    return false; // MPEG-4 Part 2 (old codec) not supported - causes black screen
  }

  if (codecLower.includes("vp8") || codecLower.includes("vp9")) {
    return false; // VP8/VP9 not supported
  }

  if (codecLower.includes("av1")) {
    return false; // AV1 not supported yet
  }

  if (codecLower.includes("vc1") || codecLower.includes("wmv")) {
    return false; // VC-1/WMV not supported
  }

  if (codecLower.includes("mpeg2")) {
    return false; // MPEG-2 not supported
  }

  if (codecLower.includes("divx") || codecLower.includes("xvid")) {
    return false; // DivX/Xvid not supported
  }

  // Default to unsupported for unknown codecs to be safe
  // Better to transcode unnecessarily than show black screen
  logger.warn("Unknown codec, defaulting to transcoding for safety", {
    service: "CodecCheck",
    codec,
  });
  return false;
}

/**
 * Check if item is audio-only (no video stream)
 * Audio-only files should be handled differently or filtered out
 */
export function isAudioOnly(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false;
  }

  // Check if there's a video stream
  const hasVideo = videoItem.MediaStreams.some((stream) => stream.Type === "Video");
  const hasAudio = videoItem.MediaStreams.some((stream) => stream.Type === "Audio");

  // Audio-only: has audio but no video
  return !hasVideo && hasAudio;
}

/**
 * Check if video needs transcoding based on its codec
 * Returns true if transcoding is required, false if direct play is supported
 */
export function needsTranscoding(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false; // Default to direct play if no info available
  }

  // Find the video stream
  const videoStream = videoItem.MediaStreams.find((stream) => stream.Type === "Video");

  if (!videoStream || !videoStream.Codec) {
    return false; // No video stream info, try direct play
  }

  const supported = isCodecSupported(videoStream.Codec);

  logger.debug("Codec check result", {
    service: "CodecCheck",
    codec: videoStream.Codec,
    supported,
  });

  return !supported;
}

/**
 * Subtitle track interface for expo-video
 * These tracks are passed to VideoSource.subtitleTracks
 */
export interface SubtitleTrack {
  uri: string;
  language: string;
  label: string;
  type: "text/vtt" | "text/srt";
}

/**
 * Get all subtitle tracks available for a video
 * Returns external subtitle files in VTT format for expo-video
 */
export function getSubtitleTracks(videoItem: JellyfinVideoItem | null): SubtitleTrack[] {
  if (!videoItem || !videoItem.MediaStreams) {
    return [];
  }

  // Find all subtitle streams
  const subtitleStreams = videoItem.MediaStreams.filter((stream) => stream.Type === "Subtitle");

  if (subtitleStreams.length === 0) {
    return [];
  }

  const tracks: SubtitleTrack[] = [];

  for (const stream of subtitleStreams) {
    // Only include external subtitle files (not embedded/burned-in)
    // IsExternal indicates the subtitle is in a separate file (like .srt)
    if (stream.IsExternal && stream.Index !== undefined) {
      // Always request VTT format for best compatibility with video players
      // Jellyfin will convert SRT to VTT automatically if needed
      const track: SubtitleTrack = {
        uri: getSubtitleUrl(videoItem.Id, stream.Index, "vtt"),
        language: stream.Language || "und",
        label: stream.DisplayTitle || stream.Language || "Unknown",
        type: "text/vtt", // Always VTT since we request .vtt format
      };
      tracks.push(track);
      logger.debug("Found external subtitle", {
        service: "Subtitles",
        label: track.label,
        language: track.language,
        uri: track.uri,
      });
    }
  }

  return tracks;
}

/**
 * Get subtitle URL for a specific stream index
 * @param itemId - The video item ID
 * @param streamIndex - The subtitle stream index from MediaStreams
 * @param format - Subtitle format (default: 'vtt' for best compatibility)
 */
export function getSubtitleUrl(itemId: string, streamIndex: number, format: string = "vtt"): string {
  // Jellyfin subtitle stream endpoint (from SubtitleController.cs)
  // Format: /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{format}
  // The format extension is required (e.g., .vtt, .srt)
  // For most cases, mediaSourceId is the same as itemId
  // VTT format is preferred as it works better with HTML5 video players
  return `${cachedConfig.server}/Videos/${itemId}/${itemId}/Subtitles/${streamIndex}/Stream.${format}?api_key=${cachedConfig.apiKey}`;
}
