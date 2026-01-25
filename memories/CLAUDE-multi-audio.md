# Multi-Audio Track Switching

**Last Updated:** January 24, 2026

## Quick Reference
**Category:** Implementation
**Keywords:** multi-audio, Swift, HLS, transcoding, audio tracks, native module, manifest

TomoTV's killer feature: seamless multi-audio track switching during transcoding using custom Swift module with HLS manifest generation.

## Related Documentation
- [`CLAUDE-api-reference.md`](./CLAUDE-api-reference.md) - Transcoding API functions
- [`CLAUDE-external-dependencies.md`](./CLAUDE-external-dependencies.md) - Swift module architecture
- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - Multi-audio implementation patterns
- [`CLAUDE-lessons-learned.md`](./CLAUDE-lessons-learned.md) - Audio track debugging cases

---

**TomoTV's Killer Feature: Seamless Multi-Audio Track Switching**

TomoTV is the **ONLY Jellyfin client** that provides perfect, seamless audio track switching during transcoding. This feature works exactly like Apple TV+, Netflix, and Disney+ - no video restarts, no interruptions, just instant audio switching.

## How It Works

### Technical Implementation

TomoTV uses a custom Swift module (`MultiAudioResourceLoader`) that intercepts HLS manifest loading and generates proper multivariant playlists client-side:

1. **Detection:** When a video with multiple audio tracks needs transcoding, TomoTV detects this in `useVideoPlayback` hook
2. **Manifest Fetching:** Custom Swift module fetches individual Jellyfin HLS manifests for each audio track
3. **Manifest Generation:** Combines all manifests into a single multivariant HLS playlist with proper `#EXT-X-MEDIA` tags
4. **Custom Protocol:** Uses `jellyfin-multi://` protocol to trigger the custom resource loader
5. **Native Discovery:** AVPlayer discovers all audio tracks from the combined manifest
6. **Seamless Switching:** User can switch between tracks during playback without interruption

### User Experience

- **Native iOS/tvOS audio picker** shows all available audio tracks
- Track labels display language, codec, and channel info: "ENGLISH (AC3 5.1)", "SPANISH (AAC STEREO)"
- **Switching is instant and seamless** - no video restart, no buffering delay
- Works exactly like premium streaming services (Apple TV+, Netflix, Disney+)
- Respects user's language preferences and device settings
- **Works during transcoding** - no need for direct play compatibility

### Subtitles (Native Toggleable Tracks)

- `SubtitleMethod=Hls` parameter tells Jellyfin to include ALL subtitle tracks in the HLS manifest
- Includes both external (.srt files) AND embedded subtitle streams
- Each subtitle appears as a separate WebVTT stream in the manifest
- expo-video auto-discovers tracks from HLS `#EXT-X-MEDIA:TYPE=SUBTITLES` tags
- Native iOS/tvOS controls provide subtitle selection UI (same as Apple TV+)
- **Fully toggleable:** Users can switch between subtitles or disable entirely during playback
- **No burning:** Subtitles are rendered as overlay, not burned into video frames
- Zero performance impact when disabled

### API Functions

- `getSubtitleTracks(videoItem)` - Returns array of subtitle tracks (both external and embedded)
- `getAudioTracks(videoItem)` - Returns array of audio tracks with full metadata
- `prepareMultiAudioPlayback(videoId, videoItem, baseUrl, apiKey)` - Prepares multi-audio custom protocol URL
- `shouldUseMultiAudio(videoItem)` - Checks if video should use multi-audio loader
- `isMultiAudioAvailable()` - Checks if native module is available (iOS/tvOS only)

## Competitive Advantage

TomoTV solves the exact problems users complain about in other Jellyfin clients:

| Feature | TomoTV | Swiftfin | Jellyfin Web |
|---------|--------|----------|--------------|
| **Multi-audio transcoding** | ✅ Seamless switching | ❌ Broken/random | ❌ Restart required |
| **Native track picker** | ✅ Always works | ⚠️ Sometimes | ❌ Custom UI |
| **Respects user settings** | ✅ Yes | ❌ No | ⚠️ Sometimes |
| **Subtitle handling** | ✅ Perfect | ⚠️ Random | ✅ Good |
| **UX quality** | ✅ Apple-level | ❌ Inconsistent | ⚠️ Web-based |

**Real User Complaints (Swiftfin):**

> "I've found that my personal settings for my user profiles aren't being read on the TVOS version of Swiftfin on my Apple TV... **languages going from English to Japanese randomly**" - App Store Review

TomoTV fixes these issues with its custom multi-audio implementation. Languages never switch randomly, settings are respected, and the experience is flawless.

## Why TomoTV is Different

Most Jellyfin clients generate a SINGLE HLS manifest per video, forcing the server to choose one audio track. When you switch audio in the player, the client must:
1. Stop video playback
2. Request NEW manifest with different audio track
3. Restart video from beginning (or try to resume with timestamp)
4. Re-buffer and hope it works

**TomoTV's Approach:**

TomoTV generates a MULTIVARIANT HLS manifest with ALL audio tracks as separate streams. AVPlayer discovers all tracks at once and switches between them in real-time without reloading the video.

**Technical Innovation:**

This required custom Swift implementation because Jellyfin's API doesn't support multivariant playlists natively. TomoTV fetches individual manifests per track and combines them client-side using a custom `AVAssetResourceLoaderDelegate`.

**User Impact:**

This is the difference between a "working" app and a "delightful" app. Users don't think about it - it just works like Apple TV+ or Netflix.

## Technical Details

### Swift Module Structure

```
ios/MultiAudioResourceLoader/
├── MultiAudioResourceLoader.swift      # AVAssetResourceLoaderDelegate
├── HLSManifestParser.swift            # Parse Jellyfin manifests
├── HLSManifestGenerator.swift         # Generate multivariant manifest
├── MultiAudioResourceLoader.m         # React Native bridge
└── MultiAudioResourceLoader-Bridging-Header.h
```

### Custom Protocol Flow

1. TypeScript detects multi-audio video during transcoding
2. Calls `prepareMultiAudioPlayback()` to configure native module
3. Native module generates `jellyfin-multi://...` URL
4. AVPlayer loads URL → triggers `AVAssetResourceLoaderDelegate`
5. Delegate fetches all Jellyfin manifests in parallel
6. Combines into multivariant playlist with all audio tracks
7. AVPlayer discovers tracks and enables native picker

### Example Generated Manifest

```m3u8
#EXTM3U
#EXT-X-VERSION:3

# Audio tracks
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="ENGLISH (AC3 5.1)",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="SPANISH (AAC STEREO)",LANGUAGE="es",AUTOSELECT=YES,URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="FRENCH (DTS 7.1)",LANGUAGE="fr",AUTOSELECT=YES,URI="..."

# Video stream with audio group reference
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1280x720,AUDIO="audio"
http://jellyfin:8096/Videos/abc123/video.m3u8?api_key=...
```

### Fallback Behavior

- **Single audio track:** Uses regular transcoding (no custom protocol overhead)
- **Direct play:** All audio tracks available natively (no custom protocol needed)
- **Non-iOS platforms:** Feature not available (iOS/tvOS only)
- **Module not available:** Falls back to regular transcoding gracefully

## Why This Matters

- **Families with different language preferences** can each watch in their preferred language
- **International content** (anime, foreign films) works perfectly
- **Accessibility** for users who need different audio tracks
- **Professional quality** that matches or exceeds premium streaming services
- **True competitive differentiation** - no other Jellyfin client has this
