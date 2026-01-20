# App Store Metadata for TomoTV

## App Name (30 characters max)
**TomoTV - Jellyfin Player**
(29 characters)

---

## Subtitle/Tagline (30 characters max)
**Stream from your media server**
(30 characters)

Alternative:
**Your Jellyfin on Apple TV**
(26 characters)

---

## Promotional Text (170 characters max)
**Stream any video from your Jellyfin server. Automatic transcoding handles incompatible formats so you can just hit play and watch. Made for Apple TV.**
(165 characters)

---

## Description (4,000 characters max)

**TomoTV** connects your Apple TV to your Jellyfin media server. Select a video, it plays. No codec errors, no configuration needed.

**HOW IT WORKS**
• H.264 and HEVC play directly
• Other formats (MPEG-4, VP8, DivX, etc.) transcode automatically
• You won't notice the difference—it just plays

**FEATURES**
• Browse and search your library
• Demo mode - try the app instantly without setup
• Full playlist support - browse and play from playlists
• Quality presets: 480p, 540p, 720p, 1080p
• Subtitle support
• Audio file playback
• Playlist auto-continue
• iCloud Keychain sync

**SETUP**
1. Run Jellyfin on your Mac, PC, or NAS
2. Enter server URL, API key, and user ID in Settings
3. Done

**REQUIREMENTS**
• Jellyfin 10.8+
• Transcoding enabled on server
• Local network or HTTPS

**PRIVACY**
No analytics. No tracking. No ads. Your credentials stay in iCloud Keychain. Video streams directly from your server.

---

## Keywords (100 characters max, comma-separated)

**jellyfin,media,player,video,streaming,plex,server,nas,local,transcode,hevc,movie,tv,remote,codec**
(99 characters)

Keywords Strategy:
- "jellyfin" (primary - core users)
- "plex" (competitor spillover)
- "media server", "nas" (adjacent searches)
- "transcode", "codec", "hevc" (technical users searching for solutions)
- "local", "remote" (usage context)

---

## What's New (4,000 characters max)

### Version 1.1.0
**Demo Mode & Playlist Support**

**New Features:**
• Demo mode - Try TomoTV instantly with Jellyfin's official demo server (no setup required)
• Full playlist support - Browse and play videos from your Jellyfin playlists
• One-tap demo connection in Settings for instant testing
• Navigate into playlists just like folders with breadcrumb navigation

**Technical:**
• Auto-fetched demo credentials from Jellyfin's public demo server
• Added playlist-specific API endpoint for proper Jellyfin integration
• Improved folder type detection for UserView and Playlist types
• Enhanced error handling for demo server connectivity

---

### Version 1.0.8
**Audio Playback Support**

**New Features:**
• Audio files now visible when browsing folders in your library
• Audio files auto-play when selected, consistent with video behavior
• Dedicated audio player UI with play/pause controls

**Improvements:**
• Play/pause button auto-focuses on Apple TV remote
• TV remote select button and play/pause button toggle playback
• Improved button styling and visibility in audio player

---

### Version 1.0.7
**Stability & Polish**

**Improvements:**
• Native tvOS search now shows error alerts when connection fails
• Debug Info screen now protects your API key (shows only last 4 characters)
• Improved logging throughout the app for better debugging
• Cleaner validation flow for server settings

**Bug Fixes:**
• Fixed silent failures in tvOS native search
• Improved error recovery during search operations

---

### Version 1.0.6
**Folder Navigation & UI Improvements**

**New Features:**
• Folder navigation - browse your library by folders with breadcrumb trail
• Back button in grid for easy parent folder navigation
• Redesigned Help screen - clean landing page with QR code to documentation

**Improvements:**
• New unified dark background (#1C1C1E) across all screens
• Removed animations for smoother folder navigation
• Better focus feedback with instant border highlights
• Settings sections now have elevated card styling

**Bug Fixes:**
• Fixed jumpiness when switching folders
• Fixed animation lag on app startup

---

### Version 1.0.5
**Initial Release - Welcome to TomoTV!**

We're excited to bring you the first release of TomoTV, built from the ground up for Apple TV and Jellyfin.

**What's Included:**
• Automatic codec detection and transcoding
• 4 quality presets (480p, 540p, 720p, 1080p)
• Library browsing with infinite scroll
• Remote search with live results
• Autoplay playlist (continuous video playback)
• Subtitle support (external tracks embedded automatically)
• iCloud Keychain credential sync
• Comprehensive help section with troubleshooting
• Native Apple TV remote support

**Known Limitations (Coming Soon):**
• Resume playback - currently starts from beginning
• Watch history tracking
• Video metadata display (year, rating, plot)
• Continue watching section

We built TomoTV to solve one major problem: codec compatibility on Apple TV. If you've ever gotten a black screen or "cannot play" error with your Jellyfin videos, TomoTV handles it automatically.

**Feedback Welcome:**
This is our first release, and we'd love to hear from you. Visit our support page to share suggestions or report issues.

Thank you for supporting independent development!

---

## App Store Categories

**Primary Category:** Photo & Video
**Secondary Category:** Entertainment

---

## Age Rating

**Rating:** 4+ (No objectionable content)

**Why 4+:**
- User-provided content (videos from user's own Jellyfin server)
- No in-app purchases or ads
- No data collection
- No social features or user-generated content beyond their own library

**Content Warnings:** None required
(App displays content from user's personal media server - similar to VLC or other media players)

---

## Privacy Policy URL (Required)

**Placeholder:** https://yourwebsite.com/tomotv/privacy

**Minimum Privacy Policy Content:**
```
TomoTV Privacy Policy

Last Updated: [Date]

OVERVIEW
TomoTV is a local media player that connects to your Jellyfin server. We do not collect, store, or transmit any user data.

DATA COLLECTION
• None. TomoTV does not collect analytics, crash reports, or usage data.
• No third-party tracking or advertising SDKs are included.

CREDENTIAL STORAGE
• Server credentials (URL, API key, User ID) are stored locally on your device using Apple's Secure Enclave (iCloud Keychain).
• Credentials sync across your Apple devices via iCloud if enabled.
• We never have access to your credentials.

DATA TRANSMISSION
• Video streams directly between your device and your Jellyfin server.
• No data passes through our servers (we don't have any servers).
• All network requests are made directly to your configured Jellyfin instance.

CONTACT
For questions or concerns: your-email@example.com
```

---

## Support URL (Required)

**Placeholder:** https://yourwebsite.com/tomotv/support

**Minimum Support Page Content:**
```
TomoTV Support

GETTING STARTED
1. Install Jellyfin (https://jellyfin.org)
2. Find your API key: Jellyfin Dashboard → API Keys → Create new key
3. Find your User ID: Jellyfin Dashboard → Users → Click your username → Copy ID from URL
4. Enter these in TomoTV Settings

COMMON ISSUES

Q: Videos won't play / black screen
A: Enable transcoding in Jellyfin Dashboard → Playback → Transcoding. Install FFmpeg if needed.

Q: Can't connect to server
A: Ensure TomoTV and Jellyfin are on same network. Check server URL includes port (e.g., http://192.168.1.100:8096)

Q: Transcoding is slow
A: Lower quality in Settings → Video Quality. Enable hardware acceleration in Jellyfin if available.

Q: Settings not saving
A: Check iCloud Keychain is enabled in iOS Settings → [Your Name] → iCloud → Keychain

CONTACT
Email: your-email@example.com
GitHub Issues: [if you make it open source]
```

---

## Marketing URL (Optional)

**Placeholder:** https://yourwebsite.com/tomotv

**Suggested Landing Page Sections:**
1. Hero: "Stream Your Jellyfin Library on Apple TV"
2. Features: Smart transcoding, quality control, TV optimized
3. Screenshots carousel
4. Setup guide (3 steps)
5. FAQ
6. Download badge (links to App Store)

---

## Copyright

**Copyright Text:** © 2025 [Your Name or Company]. All rights reserved.

---

## App Store Screenshots Requirements

### Apple TV (Required if submitting tvOS app)
- **Size:** 1920x1080 pixels
- **Required:** 1-5 screenshots
- **Recommended:** 3-5 screenshots showing:
  1. Library grid view (with poster art)
  2. Video player with controls visible
  3. Settings screen
  4. Search screen with results
  5. Help screen (shows features)

### iPhone (if applicable)
- **6.7" Display:** 1290x2796 pixels
- **Required:** 1-10 screenshots

### iPad (if applicable)
- **12.9" Display:** 2048x2732 pixels
- **Required:** 1-10 screenshots

---

## App Preview Video (Optional but Recommended)

**Duration:** 15-30 seconds
**Content Suggestions:**
1. Show library browsing (2-3 seconds)
2. Select a video (1 second)
3. Video starts playing immediately (3-4 seconds)
4. Show remote control navigation (2-3 seconds)
5. Show search feature (2-3 seconds)
6. Show quality settings (2 seconds)
7. End with app icon and tagline: "TomoTV - Your Jellyfin on Apple TV"

**Technical Requirements:**
- Resolution: 1920x1080 (Apple TV)
- Format: M4V, MP4, or MOV
- Codec: H.264 or HEVC
- Max file size: 500 MB

---

## App Store Review Notes (For Apple Reviewers)

**Demo Account Information:**

```
For testing purposes, reviewers can use our demo Jellyfin server:

Server URL: [Provide a public demo server or local setup instructions]
API Key: [Provide demo API key]
User ID: [Provide demo user ID]

Alternatively, set up a local Jellyfin server:
1. Download Jellyfin from jellyfin.org
2. Install on Mac/PC
3. Add sample videos to library
4. Create API key in dashboard
5. Use those credentials in app

Notes:
- App requires a running Jellyfin server (similar to how Plex apps require Plex server)
- Transcoding features require FFmpeg installed on Jellyfin server
- App works best on local network but supports HTTPS remote connections
```

---

## Build Number & Version Notes

**Version:** 1.1.0 (matches app.json)
**Build Number:** 6 (increment with each submission)

**Version Naming Convention Going Forward:**
- 1.0.x - Bug fixes, minor tweaks
- 1.x.0 - New features (resume playback, metadata, etc.)
- x.0.0 - Major updates (UI overhaul, new platforms)

---

## Localization (Future)

**Current:** English only
**Priority Languages for v1.1+:**
1. Spanish (es)
2. French (fr)
3. German (de)
4. Japanese (ja)
5. Portuguese (pt-BR)

---

## App Store Optimization (ASO) Strategy

**Primary Goal:** Reach Jellyfin users searching for Apple TV clients

**Target Search Terms:**
1. "jellyfin apple tv" (exact match - high intent)
2. "jellyfin player" (broad - competitor to official app)
3. "media server apple tv" (adjacent - Plex users)
4. "video player apple tv" (broad - general market)
5. "transcode player" (specific - technical users)

**Competitive Positioning:**
- Primary competitor: Swiftfin (free, open source)
- Advantage: Smart transcoding UX, quality presets, simplified setup
- Disadvantage: Missing resume playback, metadata

**Conversion Strategy:**
- Lead with "automatic transcoding" (solves immediate pain)
- Emphasize Apple TV optimization (native feel)
- Show quality presets (control over experience)
- Include screenshot of help section (reduces support burden)

---

## Character Count Summary

| Field | Limit | Current | Status |
|-------|-------|---------|--------|
| App Name | 30 | 29 | ✅ |
| Subtitle | 30 | 30 | ✅ |
| Promotional Text | 170 | 165 | ✅ |
| Description | 4,000 | ~2,200 | ✅ |
| Keywords | 100 | 99 | ✅ |
| What's New | 4,000 | ~1,400 | ✅ |

---

## Next Steps Checklist

- [ ] Create privacy policy page and get URL
- [ ] Create support page and get URL
- [ ] (Optional) Create marketing landing page
- [ ] Take 3-5 Apple TV screenshots (1920x1080)
- [ ] (Optional) Record 15-30 second app preview video
- [ ] Set up demo Jellyfin server for Apple reviewers
- [ ] Update app.json with App Store URLs
- [ ] Generate app icon in all required sizes (already have assets)
- [ ] Submit for review via App Store Connect

---

## Post-Launch Marketing

**Reddit:**
- r/jellyfin (main community)
- r/selfhosted
- r/AppleTV
- r/cordcutters

**Forums:**
- Jellyfin Community Forum
- Jellyfin Discord

**Messaging:**
"Built TomoTV to solve codec issues on Apple TV. Automatically handles transcoding so you can just hit play. Free, no ads, no tracking. Would love feedback from the community."
