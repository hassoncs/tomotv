import { isCodecSupported, needsTranscoding, isAudioOnly, formatDuration, hasPoster, searchVideos, fetchPlaylistContents } from "../jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe("jellyfinApi", () => {
  describe("isCodecSupported", () => {
    it("should support H.264/AVC codec", () => {
      expect(isCodecSupported("h264")).toBe(true);
      expect(isCodecSupported("avc")).toBe(true);
      expect(isCodecSupported("H264")).toBe(true);
    });

    it("should support HEVC/H.265 codec", () => {
      expect(isCodecSupported("hevc")).toBe(true);
      expect(isCodecSupported("h265")).toBe(true);
      expect(isCodecSupported("HEVC")).toBe(true);
    });

    it("should not support MPEG-4", () => {
      expect(isCodecSupported("mpeg4")).toBe(false);
      expect(isCodecSupported("mpeg-4")).toBe(false);
    });

    it("should not support VP8/VP9", () => {
      expect(isCodecSupported("vp8")).toBe(false);
      expect(isCodecSupported("vp9")).toBe(false);
    });

    it("should not support AV1", () => {
      expect(isCodecSupported("av1")).toBe(false);
    });

    it("should not support VC1/WMV", () => {
      expect(isCodecSupported("vc1")).toBe(false);
      expect(isCodecSupported("wmv")).toBe(false);
    });

    it("should not support MPEG-2", () => {
      expect(isCodecSupported("mpeg2")).toBe(false);
    });

    it("should not support DivX/Xvid", () => {
      expect(isCodecSupported("divx")).toBe(false);
      expect(isCodecSupported("xvid")).toBe(false);
    });

    it("should default to not supported for unknown codecs", () => {
      expect(isCodecSupported("unknown_codec")).toBe(false);
    });
  });

  describe("needsTranscoding", () => {
    it("should return false for supported codec", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "123",
        Name: "Test Video",
        MediaStreams: [{ Type: "Video", Codec: "h264", Index: 0 }],
      } as any;

      expect(needsTranscoding(videoItem)).toBe(false);
    });

    it("should return true for unsupported codec", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "123",
        Name: "Test Video",
        MediaStreams: [{ Type: "Video", Codec: "mpeg4", Index: 0 }],
      } as any;

      expect(needsTranscoding(videoItem)).toBe(true);
    });

    it("should return false when no video stream exists", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "123",
        Name: "Test Video",
        MediaStreams: [{ Type: "Audio", Codec: "aac", Index: 0 }],
      } as any;

      expect(needsTranscoding(videoItem)).toBe(false);
    });

    it("should return false when video item is null", () => {
      expect(needsTranscoding(null)).toBe(false);
    });
  });

  describe("isAudioOnly", () => {
    it("should return true for audio-only files", () => {
      const audioItem: JellyfinVideoItem = {
        Id: "123",
        Name: "Audio File",
        MediaStreams: [{ Type: "Audio", Codec: "aac", Index: 0 }],
      } as any;

      expect(isAudioOnly(audioItem)).toBe(true);
    });

    it("should return false for video files", () => {
      const videoItem: JellyfinVideoItem = {
        Id: "123",
        Name: "Video File",
        MediaStreams: [
          { Type: "Video", Codec: "h264", Index: 0 },
          { Type: "Audio", Codec: "aac", Index: 1 },
        ],
      } as any;

      expect(isAudioOnly(videoItem)).toBe(false);
    });

    it("should return false for null item", () => {
      expect(isAudioOnly(null)).toBe(false);
    });
  });

  describe("formatDuration", () => {
    it("should format hours and minutes", () => {
      const ticks = 54000000000; // 90 minutes = 1h 30m
      expect(formatDuration(ticks)).toBe("1h 30m");
    });

    it("should format minutes only", () => {
      const ticks = 27000000000; // 45 minutes
      expect(formatDuration(ticks)).toBe("45m");
    });

    it("should handle zero minutes", () => {
      const ticks = 36000000000; // 60 minutes = 1h 0m
      expect(formatDuration(ticks)).toBe("1h 0m");
    });

    it("should handle less than a minute", () => {
      const ticks = 300000000; // 30 seconds
      expect(formatDuration(ticks)).toBe("0m");
    });
  });

  describe("hasPoster", () => {
    it("should return true when poster exists", () => {
      const item: JellyfinVideoItem = {
        Id: "123",
        Name: "Test",
        ImageTags: { Primary: "abc123" },
      } as any;

      expect(hasPoster(item)).toBe(true);
    });

    it("should return false when no poster exists", () => {
      const item: JellyfinVideoItem = {
        Id: "123",
        Name: "Test",
        ImageTags: {},
      } as any;

      expect(hasPoster(item)).toBe(false);
    });

    it("should return false when ImageTags is undefined", () => {
      const item: JellyfinVideoItem = {
        Id: "123",
        Name: "Test",
      } as any;

      expect(hasPoster(item)).toBe(false);
    });
  });

  describe("searchVideos pagination", () => {
    const mockSecureStore = require("expo-secure-store");

    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn();

      // Mock SecureStore to return valid config (new format with SERVER_URL)
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        const mockConfig: Record<string, string> = {
          jellyfin_server_url: "http://192.168.1.100:8096",
          jellyfin_api_key: "test-api-key",
          jellyfin_user_id: "test-user-id",
        };
        return Promise.resolve(mockConfig[key] || null);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should return empty array for empty search term", async () => {
      const result = await searchVideos("");
      expect(result).toEqual({ items: [], total: 0 });
    });

    it("should return empty array for whitespace-only search term", async () => {
      const result = await searchVideos("   ");
      expect(result).toEqual({ items: [], total: 0 });
    });

    it("should call API with correct pagination parameters", async () => {
      const mockResponse = {
        Items: [
          { Id: "1", Name: "Video 1", Type: "Movie" },
          { Id: "2", Name: "Video 2", Type: "Movie" },
        ],
        TotalRecordCount: 100,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("test", { limit: 20, startIndex: 0 });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("SearchTerm=test"), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("Limit=20"), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("StartIndex=0"), expect.any(Object));
      expect(result.items).toHaveLength(2);
      // Total preserves server's TotalRecordCount for proper pagination
      expect(result.total).toBe(100);
    });

    it("should handle pagination with custom startIndex", async () => {
      const mockResponse = {
        Items: [
          { Id: "21", Name: "Video 21", Type: "Movie" },
          { Id: "22", Name: "Video 22", Type: "Movie" },
        ],
        TotalRecordCount: 100,
        StartIndex: 20,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("test", { limit: 20, startIndex: 20 });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("StartIndex=20"), expect.any(Object));
      expect(result.items).toHaveLength(2);
      // Total preserves server's TotalRecordCount for proper pagination
      expect(result.total).toBe(100);
    });

    it("should use default pagination values when not specified", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await searchVideos("test");

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("Limit=60"), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("StartIndex=0"), expect.any(Object));
    });

    it("should return correct structure with items and total", async () => {
      const mockResponse = {
        Items: [
          { Id: "1", Name: "Video 1", Type: "Movie" },
          { Id: "2", Name: "Video 2", Type: "Movie" },
          { Id: "3", Name: "Video 3", Type: "Movie" },
        ],
        TotalRecordCount: 150,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("action", { limit: 3, startIndex: 0 });

      // Total preserves server's TotalRecordCount for proper pagination
      expect(result).toEqual({
        items: mockResponse.Items,
        total: 150,
      });
    });

    it("should handle response without TotalRecordCount", async () => {
      const mockResponse = {
        Items: [{ Id: "1", Name: "Video 1", Type: "Movie" }],
        // TotalRecordCount is optional in the API
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("test");

      expect(result.items).toHaveLength(1);
      // Total now reflects actual items returned
      expect(result.total).toBe(1);
    });

    it("should trim search term before sending to API", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await searchVideos("  test query  ");

      // URLSearchParams encodes spaces as '+' which is valid
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toMatch(/SearchTerm=test(\+|%20)query/);
    });

    it("should handle empty results correctly", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("nonexistent");

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should handle last page of results correctly", async () => {
      const mockResponse = {
        Items: [
          { Id: "96", Name: "Video 96", Type: "Movie" },
          { Id: "97", Name: "Video 97", Type: "Movie" },
        ],
        TotalRecordCount: 97,
        StartIndex: 95,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchVideos("test", { limit: 60, startIndex: 95 });

      expect(result.items).toHaveLength(2);
      // Total preserves server's TotalRecordCount for proper pagination
      expect(result.total).toBe(97);
    });
  });

  describe("fetchPlaylistContents", () => {
    const mockSecureStore = require("expo-secure-store");

    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn();

      // Mock SecureStore to return valid config
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        const mockConfig: Record<string, string> = {
          jellyfin_server_url: "http://192.168.1.100:8096",
          jellyfin_api_key: "test-api-key",
          jellyfin_user_id: "test-user-id",
        };
        return Promise.resolve(mockConfig[key] || null);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should fetch playlist contents successfully", async () => {
      const mockResponse = {
        Items: [
          { Id: "1", Name: "Video 1", Type: "Movie" },
          { Id: "2", Name: "Video 2", Type: "Episode" },
        ],
        TotalRecordCount: 2,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaylistContents("playlist-123");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/Playlists/playlist-123/Items"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "application/json",
            Authorization: 'MediaBrowser Token="test-api-key"',
          }),
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should call API with correct pagination parameters", async () => {
      const mockResponse = {
        Items: [{ Id: "1", Name: "Video 1", Type: "Movie" }],
        TotalRecordCount: 100,
        StartIndex: 20,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaylistContents("playlist-456", { limit: 30, startIndex: 20 });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("Limit=30"), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("StartIndex=20"), expect.any(Object));
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
    });

    it("should use default pagination values when not specified", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await fetchPlaylistContents("playlist-789");

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("Limit=60"), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("StartIndex=0"), expect.any(Object));
    });

    it("should handle response without TotalRecordCount", async () => {
      const mockResponse = {
        Items: [{ Id: "1", Name: "Video 1", Type: "Movie" }],
        StartIndex: 0,
        // TotalRecordCount is optional in the API
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaylistContents("playlist-abc");

      expect(result.items).toHaveLength(1);
      expect(result.total).toBeUndefined();
    });

    it("should handle empty playlist", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaylistContents("empty-playlist");

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should throw error when server is not configured", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await expect(fetchPlaylistContents("playlist-123")).rejects.toThrow("Jellyfin server not configured.");
    });

    it("should throw error on HTTP error response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchPlaylistContents("nonexistent-playlist")).rejects.toThrow("Failed to fetch playlist contents: 404");
    });

    it("should throw error on network failure", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchPlaylistContents("playlist-123")).rejects.toThrow();
    });

    it("should retry on network failure", async () => {
      // First attempt fails with network error (retryable), second succeeds
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network request failed")).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [{ Id: "1", Name: "Video 1", Type: "Movie" }],
          TotalRecordCount: 1,
          StartIndex: 0,
        }),
      });

      const result = await fetchPlaylistContents("playlist-retry");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(1);
    });

    it("should fail after max retry attempts", async () => {
      // All attempts fail with network error (retryable)
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchPlaylistContents("playlist-fail")).rejects.toThrow("Network error");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should include correct query parameters", async () => {
      const mockResponse = {
        Items: [],
        TotalRecordCount: 0,
        StartIndex: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await fetchPlaylistContents("playlist-xyz", { limit: 10, startIndex: 5 });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain("userId=test-user-id");
      expect(callUrl).toContain("StartIndex=5");
      expect(callUrl).toContain("Limit=10");
      // Fields parameter is URL-encoded
      expect(decodeURIComponent(callUrl)).toContain("Fields=Path,MediaStreams,Genres,ChildCount,ParentId,ImageTags,PrimaryImageAspectRatio");
    });

    it("should not retry on HTTP error responses", async () => {
      // HTTP errors are not retryable, so fetch should only be called once
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchPlaylistContents("playlist-404")).rejects.toThrow("Failed to fetch playlist contents: 404");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
