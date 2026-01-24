/**
 * multiAudioLoader.test.ts
 *
 * Comprehensive unit tests for multi-audio track selection and playback preparation.
 * Tests cover platform detection, language preference logic, native module integration,
 * and edge cases.
 *
 * Created: January 24, 2026
 */

import { Platform } from "react-native";
import type { JellyfinVideoItem } from "@/types/jellyfin";
import {
  registerMultiAudioPlugin,
  isMultiAudioAvailable,
  getAudioTracks,
  prepareMultiAudioPlayback,
  shouldUseMultiAudio,
  type AudioTrackInfo,
} from "../multiAudioLoader";

// Create mock module
const mockNativeModule = {
  registerVideoPlugin: jest.fn(),
  configureResourceLoader: jest.fn(),
  generateCustomUrl: jest.fn(),
};

// Mock dependencies
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
  NativeModules: {
    MultiAudioResourceLoader: mockNativeModule,
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import mocked logger after setup
import { logger } from "@/utils/logger";

const { NativeModules } = require("react-native");

describe("multiAudioLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset NativeModules to default state
    NativeModules.MultiAudioResourceLoader = mockNativeModule;

    // Reset plugin registration state by reimporting the module
    jest.resetModules();
  });

  describe("registerMultiAudioPlugin", () => {
    it("should register plugin on iOS platform", async () => {
      Platform.OS = "ios";
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockResolvedValue(undefined);

      await registerMultiAudioPlugin();

      expect(NativeModules.MultiAudioResourceLoader.registerVideoPlugin).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        "Registering multi-audio video plugin",
        expect.objectContaining({ service: "MultiAudioLoader" })
      );
    });

    it("should skip registration on Android platform", async () => {
      Platform.OS = "android";

      await registerMultiAudioPlugin();

      expect(NativeModules.MultiAudioResourceLoader.registerVideoPlugin).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping plugin registration: not iOS platform",
        expect.objectContaining({ platform: "android" })
      );
    });

    it("should skip registration if native module not available", async () => {
      Platform.OS = "ios";
      const originalModule = NativeModules.MultiAudioResourceLoader;
      NativeModules.MultiAudioResourceLoader = null;

      await registerMultiAudioPlugin();

      expect(logger.warn).toHaveBeenCalledWith(
        "Multi-audio native module not available",
        expect.any(Object)
      );

      NativeModules.MultiAudioResourceLoader = originalModule;
    });

    it("should only register plugin once", async () => {
      Platform.OS = "ios";
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockResolvedValue(undefined);

      await registerMultiAudioPlugin();
      await registerMultiAudioPlugin();

      expect(NativeModules.MultiAudioResourceLoader.registerVideoPlugin).toHaveBeenCalledTimes(1);
    });

    it("should throw error if registration fails", async () => {
      Platform.OS = "ios";
      const error = new Error("Native registration failed");
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockRejectedValue(error);

      await expect(registerMultiAudioPlugin()).rejects.toThrow("Native registration failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to register multi-audio plugin",
        expect.objectContaining({ error })
      );
    });
  });

  describe("isMultiAudioAvailable", () => {
    it("should return false on non-iOS platforms", () => {
      Platform.OS = "android";

      const result = isMultiAudioAvailable();

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        "Multi-audio not available: not iOS platform",
        expect.objectContaining({ platform: "android" })
      );
    });

    it("should return false if plugin not registered", () => {
      Platform.OS = "ios";
      (global as any).pluginRegistered = false;

      const result = isMultiAudioAvailable();

      expect(result).toBe(false);
    });

    it("should return true on iOS with registered plugin", async () => {
      Platform.OS = "ios";
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockResolvedValue(undefined);

      await registerMultiAudioPlugin();
      const result = isMultiAudioAvailable();

      expect(result).toBe(true);
    });

    it("should return false if native module is null", () => {
      Platform.OS = "ios";
      const originalModule = NativeModules.MultiAudioResourceLoader;
      NativeModules.MultiAudioResourceLoader = null;

      const result = isMultiAudioAvailable();

      expect(result).toBe(false);

      NativeModules.MultiAudioResourceLoader = originalModule;
    });
  });

  describe("getAudioTracks", () => {
    it("should extract audio tracks from MediaStreams", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-1",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
          },
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (AAC Stereo)",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish (AC3 5.1)",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(2);
      expect(tracks[0]).toMatchObject({
        Index: 1,
        Language: "eng",
        Codec: "aac",
        Channels: 2,
        DisplayTitle: "English (AAC Stereo)",
      });
      expect(tracks[1]).toMatchObject({
        Index: 2,
        Language: "spa",
        Codec: "ac3",
        Channels: 6,
      });
    });

    it("should fallback to MediaSources[0].MediaStreams if top-level is empty", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-2",
        Name: "Test Video",
        MediaStreams: [],
        MediaSources: [
          {
            MediaStreams: [
              {
                Type: "Audio",
                Index: 1,
                Language: "eng",
                Codec: "aac",
                Channels: 2,
                DisplayTitle: "English",
                IsDefault: true,
              },
            ],
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Language).toBe("eng");
    });

    it("should return empty array if no audio tracks found", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-3",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle missing MediaStreams gracefully", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-4",
        Name: "Test Video",
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(0);
    });

    it("should prefer English track as default", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-5",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown",
            IsDefault: true, // Jellyfin says this is default
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      // English should be sorted first and marked as default
      expect(tracks[0].Language).toBe("eng");
      expect(tracks[0].IsDefault).toBe(true);
      expect(tracks[1].IsDefault).toBe(false);
    });

    it("should prefer non-UND track if no English available", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-6",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "jpn",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Japanese",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks[0].Language).toBe("jpn");
      expect(tracks[0].IsDefault).toBe(true);
    });

    it("should use first track as fallback if all are UND", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-7",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown 1",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown 2",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks[0].Index).toBe(1);
      expect(tracks[0].IsDefault).toBe(true);
    });

    it("should handle single audio track without reordering", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-8",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].IsDefault).toBe(true);
    });

    it("should handle missing optional fields with defaults", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-9",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            // Missing: Language, Codec, Channels, DisplayTitle, IsDefault
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0]).toMatchObject({
        Index: 1,
        Language: "und",
        Codec: "unknown",
        Channels: 2,
        IsDefault: true,
      });
    });

    it("should recognize English language variants", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video-10",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "en-US",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (US)",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "en-GB",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (UK)",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      // First English variant should be preferred
      expect(tracks[0].Language).toBe("en-US");
      expect(tracks[0].IsDefault).toBe(true);
    });
  });

  describe("prepareMultiAudioPlayback", () => {
    beforeEach(async () => {
      Platform.OS = "ios";
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockResolvedValue(undefined);
      await registerMultiAudioPlugin();
    });

    it("should prepare multi-audio playback successfully", async () => {
      const videoId = "test-video-id";
      const videoItem: JellyfinVideoItem = {
        Id: videoId,
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish",
            IsDefault: false,
          },
        ],
      };
      const baseUrl = "http://jellyfin:8096/Videos/abc123/master.m3u8";
      const apiKey = "test-api-key";

      NativeModules.MultiAudioResourceLoader.configureResourceLoader.mockResolvedValue(undefined);
      NativeModules.MultiAudioResourceLoader.generateCustomUrl.mockResolvedValue(
        "file:///tmp/manifest.m3u8"
      );

      const result = await prepareMultiAudioPlayback(videoId, videoItem, baseUrl, apiKey);

      expect(result).toBe("file:///tmp/manifest.m3u8");
      expect(NativeModules.MultiAudioResourceLoader.configureResourceLoader).toHaveBeenCalledWith(
        baseUrl,
        apiKey,
        videoId,
        expect.arrayContaining([
          expect.objectContaining({ Language: "eng" }),
          expect.objectContaining({ Language: "spa" }),
        ])
      );
      expect(NativeModules.MultiAudioResourceLoader.generateCustomUrl).toHaveBeenCalledWith(
        videoId
      );
    });

    it("should throw error if multi-audio not available", async () => {
      Platform.OS = "android";

      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      await expect(
        prepareMultiAudioPlayback("test-video", videoItem, "http://test", "api-key")
      ).rejects.toThrow("Multi-audio native module not available on this platform");
    });

    it("should throw error if no audio tracks found", async () => {
      Platform.OS = "ios";

      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [],
      };

      await expect(
        prepareMultiAudioPlayback("test-video", videoItem, "http://test", "api-key")
      ).rejects.toThrow("No audio tracks found in video metadata");
    });

    it("should throw error if native configuration fails", async () => {
      Platform.OS = "ios";

      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      const error = new Error("Native configuration error");
      NativeModules.MultiAudioResourceLoader.configureResourceLoader.mockRejectedValue(error);

      await expect(
        prepareMultiAudioPlayback("test-video", videoItem, "http://test", "api-key")
      ).rejects.toThrow("Native configuration error");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to prepare multi-audio playback",
        expect.objectContaining({ error })
      );
    });

    it("should pass sorted audio tracks to native module", async () => {
      Platform.OS = "ios";

      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: false,
          },
        ],
      };

      NativeModules.MultiAudioResourceLoader.configureResourceLoader.mockResolvedValue(undefined);
      NativeModules.MultiAudioResourceLoader.generateCustomUrl.mockResolvedValue("file:///tmp/manifest.m3u8");

      await prepareMultiAudioPlayback("test-video", videoItem, "http://test", "api-key");

      // Verify English track is passed first (sorted by preference)
      const configCall = NativeModules.MultiAudioResourceLoader.configureResourceLoader.mock.calls[0];
      const tracks = configCall[3] as AudioTrackInfo[];
      expect(tracks[0].Language).toBe("eng");
      expect(tracks[0].IsDefault).toBe(true);
    });
  });

  describe("shouldUseMultiAudio", () => {
    beforeEach(async () => {
      Platform.OS = "ios";
      NativeModules.MultiAudioResourceLoader.registerVideoPlugin.mockResolvedValue(undefined);
      await registerMultiAudioPlugin();
    });

    it("should return true for video with multiple audio tracks", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish",
            IsDefault: false,
          },
        ],
      };

      const result = shouldUseMultiAudio(videoItem);

      expect(result).toBe(true);
    });

    it("should return false for video with single audio track", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      const result = shouldUseMultiAudio(videoItem);

      expect(result).toBe(false);
    });

    it("should return false for video with no audio tracks", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [],
      };

      const result = shouldUseMultiAudio(videoItem);

      expect(result).toBe(false);
    });

    it("should return false if multi-audio not available", () => {
      Platform.OS = "android";

      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish",
            IsDefault: false,
          },
        ],
      };

      const result = shouldUseMultiAudio(videoItem);

      expect(result).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle video with mixed track types correctly", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
          },
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
          {
            Type: "Subtitle",
            Index: 2,
            Language: "eng",
            DisplayTitle: "English Subtitles",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 3,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish",
            IsDefault: false,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(2);
      expect(tracks.every(t => t.Index === 1 || t.Index === 3)).toBe(true);
    });

    it("should handle tracks with Index = 0", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 0,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Index).toBe(0);
    });

    it("should handle tracks with undefined Index", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            // Index is undefined
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Index).toBe(0); // Defaults to 0
    });

    it("should handle empty DisplayTitle gracefully", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "test-video",
        Name: "Test Video",
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            IsDefault: true,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem);

      expect(tracks[0].DisplayTitle).toMatch(/eng.*aac/i);
    });
  });
});
