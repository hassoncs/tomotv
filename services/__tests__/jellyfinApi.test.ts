import {
  isCodecSupported,
  needsTranscoding,
  isAudioOnly,
  formatDuration,
  hasPoster
} from '../jellyfinApi';
import {JellyfinVideoItem} from '@/types/jellyfin';

describe('jellyfinApi', () => {
  describe('isCodecSupported', () => {
    it('should support H.264/AVC codec', () => {
      expect(isCodecSupported('h264')).toBe(true);
      expect(isCodecSupported('avc')).toBe(true);
      expect(isCodecSupported('H264')).toBe(true);
    });

    it('should support HEVC/H.265 codec', () => {
      expect(isCodecSupported('hevc')).toBe(true);
      expect(isCodecSupported('h265')).toBe(true);
      expect(isCodecSupported('HEVC')).toBe(true);
    });

    it('should not support MPEG-4', () => {
      expect(isCodecSupported('mpeg4')).toBe(false);
      expect(isCodecSupported('mpeg-4')).toBe(false);
    });

    it('should not support VP8/VP9', () => {
      expect(isCodecSupported('vp8')).toBe(false);
      expect(isCodecSupported('vp9')).toBe(false);
    });

    it('should not support AV1', () => {
      expect(isCodecSupported('av1')).toBe(false);
    });

    it('should not support VC1/WMV', () => {
      expect(isCodecSupported('vc1')).toBe(false);
      expect(isCodecSupported('wmv')).toBe(false);
    });

    it('should not support MPEG-2', () => {
      expect(isCodecSupported('mpeg2')).toBe(false);
    });

    it('should not support DivX/Xvid', () => {
      expect(isCodecSupported('divx')).toBe(false);
      expect(isCodecSupported('xvid')).toBe(false);
    });

    it('should default to not supported for unknown codecs', () => {
      expect(isCodecSupported('unknown_codec')).toBe(false);
    });
  });

  describe('needsTranscoding', () => {
    it('should return false for supported codec', () => {
      const videoItem: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test Video',
        MediaStreams: [
          {Type: 'Video', Codec: 'h264', Index: 0}
        ]
      } as any;

      expect(needsTranscoding(videoItem)).toBe(false);
    });

    it('should return true for unsupported codec', () => {
      const videoItem: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test Video',
        MediaStreams: [
          {Type: 'Video', Codec: 'mpeg4', Index: 0}
        ]
      } as any;

      expect(needsTranscoding(videoItem)).toBe(true);
    });

    it('should return false when no video stream exists', () => {
      const videoItem: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test Video',
        MediaStreams: [
          {Type: 'Audio', Codec: 'aac', Index: 0}
        ]
      } as any;

      expect(needsTranscoding(videoItem)).toBe(false);
    });

    it('should return false when video item is null', () => {
      expect(needsTranscoding(null)).toBe(false);
    });
  });

  describe('isAudioOnly', () => {
    it('should return true for audio-only files', () => {
      const audioItem: JellyfinVideoItem = {
        Id: '123',
        Name: 'Audio File',
        MediaStreams: [
          {Type: 'Audio', Codec: 'aac', Index: 0}
        ]
      } as any;

      expect(isAudioOnly(audioItem)).toBe(true);
    });

    it('should return false for video files', () => {
      const videoItem: JellyfinVideoItem = {
        Id: '123',
        Name: 'Video File',
        MediaStreams: [
          {Type: 'Video', Codec: 'h264', Index: 0},
          {Type: 'Audio', Codec: 'aac', Index: 1}
        ]
      } as any;

      expect(isAudioOnly(videoItem)).toBe(false);
    });

    it('should return false for null item', () => {
      expect(isAudioOnly(null)).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('should format hours and minutes', () => {
      const ticks = 54000000000; // 90 minutes = 1h 30m
      expect(formatDuration(ticks)).toBe('1h 30m');
    });

    it('should format minutes only', () => {
      const ticks = 27000000000; // 45 minutes
      expect(formatDuration(ticks)).toBe('45m');
    });

    it('should handle zero minutes', () => {
      const ticks = 36000000000; // 60 minutes = 1h 0m
      expect(formatDuration(ticks)).toBe('1h 0m');
    });

    it('should handle less than a minute', () => {
      const ticks = 300000000; // 30 seconds
      expect(formatDuration(ticks)).toBe('0m');
    });
  });

  describe('hasPoster', () => {
    it('should return true when poster exists', () => {
      const item: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test',
        ImageTags: {Primary: 'abc123'}
      } as any;

      expect(hasPoster(item)).toBe(true);
    });

    it('should return false when no poster exists', () => {
      const item: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test',
        ImageTags: {}
      } as any;

      expect(hasPoster(item)).toBe(false);
    });

    it('should return false when ImageTags is undefined', () => {
      const item: JellyfinVideoItem = {
        Id: '123',
        Name: 'Test'
      } as any;

      expect(hasPoster(item)).toBe(false);
    });
  });
});
