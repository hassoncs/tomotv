# expo-tvos-search

A native tvOS search component for Expo/React Native apps using SwiftUI's `.searchable` modifier. Provides a seamless, native search experience with proper focus navigation and keyboard handling on Apple TV.

## Why Native?

React Native's `TextInput` + `FlatList` combination has known focus navigation issues on tvOS:
- Single results cannot receive focus when pressing DOWN from TextInput
- Cannot refocus TextInput after initial search
- `nextFocusDown` prop doesn't work reliably with `FlatList` items using `numColumns > 1`

This module solves these issues by using SwiftUI's native `.searchable` modifier, which handles all focus and keyboard navigation correctly by design.

## Features

- Native tvOS search experience using SwiftUI
- Proper focus navigation between search field and results
- Keyboard input handling that matches native tvOS apps
- Configurable grid layout with customizable columns
- Optional title/subtitle display on result cards
- Loading state indicator
- Graceful fallback for non-tvOS platforms

## Installation

```bash
npm install expo-tvos-search
# or
yarn add expo-tvos-search
```

After installation, rebuild your native project:

```bash
npx expo prebuild --clean
npx expo run:ios
```

For tvOS specifically:

```bash
EXPO_TV=1 npx expo prebuild --clean
npx expo run:ios
```

## Requirements

- Expo SDK 51+
- React Native (react-native-tvos for TV apps)
- tvOS 15.0+
- iOS 15.1+ (fallback only)

## Usage

### Basic Example

```tsx
import { TvosSearchView, SearchResult, isNativeSearchAvailable } from 'expo-tvos-search';

function SearchScreen() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback((event: { nativeEvent: { query: string } }) => {
    const query = event.nativeEvent.query;

    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    // Your search API call here
    fetchSearchResults(query).then(items => {
      setResults(items.map(item => ({
        id: item.id,
        title: item.name,
        subtitle: item.year,
        imageUrl: item.posterUrl,
      })));
      setIsLoading(false);
    });
  }, []);

  const handleSelectItem = useCallback((event: { nativeEvent: { id: string } }) => {
    const selectedId = event.nativeEvent.id;
    // Navigate to detail screen
    router.push(`/detail/${selectedId}`);
  }, []);

  return (
    <TvosSearchView
      results={results}
      columns={5}
      placeholder="Search movies..."
      isLoading={isLoading}
      topInset={140}
      onSearch={handleSearch}
      onSelectItem={handleSelectItem}
      style={{ flex: 1 }}
    />
  );
}
```

### With Fallback for Non-tvOS

```tsx
import { TvosSearchView, isNativeSearchAvailable } from 'expo-tvos-search';

function SearchScreen() {
  if (isNativeSearchAvailable()) {
    return <NativeTvosSearch />;
  }

  // Fallback to your React Native implementation
  return <ReactNativeSearch />;
}
```

### With All Styling Options

```tsx
<TvosSearchView
  results={results}
  columns={5}
  placeholder="Search movies and TV shows..."
  isLoading={isLoading}
  showTitle={true}
  showSubtitle={true}
  showFocusBorder={true}
  topInset={140}
  onSearch={handleSearch}
  onSelectItem={handleSelectItem}
  style={{ flex: 1, backgroundColor: '#1C1C1E' }}
/>
```

## API Reference

### `TvosSearchView`

The main component that renders the native tvOS search interface.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `results` | `SearchResult[]` | `[]` | Array of search results to display |
| `columns` | `number` | `5` | Number of columns in the results grid |
| `placeholder` | `string` | `"Search movies and videos..."` | Placeholder text for the search field |
| `isLoading` | `boolean` | `false` | Shows loading indicator when `true` |
| `showTitle` | `boolean` | `false` | Display title text below each result card |
| `showSubtitle` | `boolean` | `false` | Display subtitle text below title |
| `showFocusBorder` | `boolean` | `false` | Show gold border on focused card |
| `topInset` | `number` | `0` | Extra top padding in points (for tab bar clearance) |
| `onSearch` | `(event) => void` | **required** | Called when search text changes |
| `onSelectItem` | `(event) => void` | **required** | Called when a result item is selected |
| `style` | `ViewStyle` | `undefined` | Style applied to the container |

#### Event Handlers

**`onSearch`**
```typescript
onSearch: (event: { nativeEvent: { query: string } }) => void
```
Called whenever the search text changes. The `query` contains the current search string.

**`onSelectItem`**
```typescript
onSelectItem: (event: { nativeEvent: { id: string } }) => void
```
Called when the user selects (presses) a result item. The `id` corresponds to the `SearchResult.id`.

### `SearchResult`

Interface for search result items.

```typescript
interface SearchResult {
  id: string;        // Unique identifier
  title: string;     // Display title
  subtitle?: string; // Optional subtitle (e.g., year, genre)
  imageUrl?: string; // Optional poster/thumbnail URL
}
```

### `isNativeSearchAvailable()`

```typescript
function isNativeSearchAvailable(): boolean
```

Returns `true` if the native tvOS search view is available (running on tvOS with the native module loaded). Use this to conditionally render a fallback UI on non-tvOS platforms.

## Styling Guide

### Clean Poster Grid (Default)

For a minimal, poster-only look (like Netflix):

```tsx
<TvosSearchView
  results={results}
  columns={5}
  topInset={140}
  onSearch={handleSearch}
  onSelectItem={handleSelectItem}
/>
```

### With Titles

For showing movie/show titles below posters:

```tsx
<TvosSearchView
  results={results}
  columns={5}
  showTitle={true}
  topInset={140}
  onSearch={handleSearch}
  onSelectItem={handleSelectItem}
/>
```

### Full Information Display

For showing all available information:

```tsx
<TvosSearchView
  results={results}
  columns={4}  // Fewer columns to accommodate text
  showTitle={true}
  showSubtitle={true}
  showFocusBorder={true}
  topInset={140}
  onSearch={handleSearch}
  onSelectItem={handleSelectItem}
/>
```

### Tab Bar Clearance

When using with Expo Router's tab navigation, set `topInset` to clear the tab bar:

```tsx
// For standard tvOS tab bar
<TvosSearchView topInset={140} ... />

// Adjust based on your tab bar height
<TvosSearchView topInset={120} ... />
```

## Platform Support

| Platform | Support |
|----------|---------|
| tvOS | Full native support |
| iOS | Fallback (renders message) |
| Android | Not supported |
| Web | Not supported |

## Troubleshooting

### Native module not loading

If you see the warning "expo-tvos-search: Native module not available", ensure you've rebuilt the native project:

```bash
EXPO_TV=1 npx expo prebuild --clean
npx expo run:ios
```

### Search field position issues

If the search field overlaps with your tab bar, increase the `topInset` value:

```tsx
<TvosSearchView topInset={160} ... />
```

### Focus not working correctly

Ensure you're running on an actual tvOS device or simulator. Focus navigation requires the tvOS focus engine.

## Example App

This module is part of [TomoTV](https://github.com/keiver/tomotv), a cross-platform video streaming app for Jellyfin. See the search screen implementation in `app/(tabs)/search.tsx` for a complete working example.

## Contributing

Contributions are welcome! Please open an issue or pull request on the [TomoTV repository](https://github.com/keiver/tomotv).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**Keiver Hernandez** - [@keiver](https://github.com/keiver)

## Acknowledgments

- Built with [Expo Modules API](https://docs.expo.dev/modules/overview/)
- Uses SwiftUI's [.searchable](https://developer.apple.com/documentation/swiftui/view/searchable(text:placement:prompt:)-1r1py) modifier
- Inspired by native tvOS apps like Netflix and Apple TV+
- Part of the [TomoTV](https://github.com/keiver/tomotv) project
