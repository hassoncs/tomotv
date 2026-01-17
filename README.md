# TomoTV

A React Native tvOS client for Jellyfin media server.

Built to stream my personal video library from my Mac to every Apple TV in my home.

<p align="center">
  <img src="assets/images/screenshots/results.png" width="700" alt="TomoTV Search Results"/>
</p>

<table>
  <tr>
    <td align="center">
      <img src="assets/images/screenshots/default.png" width="280" alt="Search"/><br/>
      <sub>Native Search</sub>
    </td>
    <td align="center">
      <img src="assets/images/screenshots/results.png" width="280" alt="Results"/><br/>
      <sub>Results</sub>
    </td>
    <td align="center">
      <img src="assets/images/screenshots/no-results.webp" width="280" alt="No Results"/><br/>
      <sub>Empty State</sub>
    </td>
  </tr>
</table>

## Features

- **Native tvOS experience** — SwiftUI search with proper focus navigation
- **Jellyfin integration** — Connect to your self-hosted media server
- **Smart codec handling** — Direct plays H.264/HEVC, transcodes everything else
- **Secure storage** — Credentials stored in Keychain

## Quick Start

```bash
git clone https://github.com/keiver/tomotv.git
cd tomotv
npm install
cp .env.example .env.local
# Add your Jellyfin server URL, API key, and user ID
npm run prebuild:tv
npx expo run:ios
```

## Requirements

- Your Jellyfin server, find our more about Jellyfin [here](https://jellyfin.org/)
- Apple TV 4K (or simulator)
- Xcode 15+
- Node.js 18+

## Tech Stack

React Native TVOS · Expo · SwiftUI · TypeScript

## Packages

This project includes [`expo-tvos-search`](https://github.com/keiver/expo-tvos-search) — a native tvOS search module using SwiftUI's `.searchable` modifier. It solves the focus navigation issues that exist with React Native's TextInput + FlatList on tvOS.

## License

MIT
