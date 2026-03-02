# Option A: Fork expo-tvos-search — Add "input" Mode with RN Children

## Goal

Fork `keiver/expo-tvos-search` to add a new `mode="input"` that provides ONLY the native tvOS inline keyboard + mic button (via SwiftUI `.searchable`), while letting React Native children fill the content area below. This gives us the dictation-friendly UX without the Siri popup, while rendering our own custom AI tab UI (status cards, quick actions, SDUI canvas, etc.) as normal React Native components.

## Why This Approach

- `expo-tvos-search` already solves the hardest problems: UISearchController lifecycle, focus engine integration, gesture handler toggling, keyboard management
- The library is small (1649 lines Swift, 532 lines TS) and well-structured
- MIT licensed, already in our dependency tree
- Adding a `mode` prop is surgical — most of the library stays unchanged

## Architecture

```
┌─────────────────────────────────────────┐
│  ExpoTvosSearchView (ExpoView/UIView)  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  UIHostingController              │  │
│  │  SwiftUI NavigationView           │  │
│  │  + .searchable modifier           │  │
│  │  = Inline keyboard + mic button   │  │
│  │                                   │  │
│  │  Content: Color.clear (input mode)│  │
│  │  Content: LazyVGrid (search mode) │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  RN Children Container (UIView)   │  │ ← Only in "input" mode
│  │                                   │  │
│  │  [React Native children here]     │  │
│  │  - Status cards                   │  │
│  │  - Quick actions                  │  │
│  │  - SDUI canvas                    │  │
│  │  - Anything you want              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  UIFocusGuide                     │  │ ← Bridges focus between
│  │  (search bar ↔ RN content)        │  │   SwiftUI and RN
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Files to Modify

### 1. `TvosSearchContentView.swift` (143 lines)

**Change**: Add a `mode` property to `SearchViewModel`. When `mode == "input"`, the body renders `Color.clear` instead of the results grid / empty state / no results views.

```swift
// In SearchViewModel:
@Published var mode: String = "search" // "search" or "input"

// In TvosSearchContentView body:
var body: some View {
    NavigationView {
        ZStack {
            if viewModel.mode == "input" {
                // Input mode: transparent content, RN children render below via UIKit
                Color.clear
            } else {
                // Search mode: existing behavior (results grid, empty state, etc.)
                Group { /* existing code */ }
            }
        }
        .searchable(text: $viewModel.searchText, prompt: viewModel.placeholder)
        .onChange(of: viewModel.searchText) { newValue in
            viewModel.onSearch?(newValue)
        }
    }
    .tint(viewModel.accentColor)
    .modifier(TopInsetModifier(topInset: viewModel.topInset))
}
```

### 2. `ExpoTvosSearchView.swift` (670 lines)

**Changes**:

a) Add `mode` property:
```swift
var mode: String = "search" {
    didSet {
        viewModel.mode = mode
        updateLayoutForMode()
    }
}
```

b) Add RN children container:
```swift
private let rnContentContainer = UIView()
```

c) Override `layoutSubviews` to position RN children below the search bar when in "input" mode:
```swift
override func layoutSubviews() {
    super.layoutSubviews()
    
    guard mode == "input" else { return }
    
    // The SwiftUI hosting controller fills the full view,
    // but the search bar portion is at the top.
    // The search bar on tvOS is approximately 80-100pt tall.
    // We let the hosting controller fill the view (for .searchable to work),
    // but position the RN content container over the transparent content area.
    
    let searchBarHeight: CGFloat = 140 // Accounts for keyboard row + padding
    
    rnContentContainer.frame = CGRect(
        x: 0,
        y: searchBarHeight,
        width: bounds.width,
        height: bounds.height - searchBarHeight
    )
    
    // Move RN children (added by React Native as subviews of self)
    // into the content container so they appear below the search bar
    for subview in subviews {
        if subview !== hostingController?.view && subview !== rnContentContainer && subview !== focusGuide {
            rnContentContainer.addSubview(subview)
        }
    }
}
```

d) Add `UIFocusGuide` to bridge focus from search bar to RN content:
```swift
private var focusGuide: UIFocusGuide?

private func setupFocusGuide() {
    let guide = UIFocusGuide()
    addLayoutGuide(guide)
    focusGuide = guide
    
    // Position the guide between the search bar and RN content
    NSLayoutConstraint.activate([
        guide.topAnchor.constraint(equalTo: rnContentContainer.topAnchor),
        guide.leadingAnchor.constraint(equalTo: leadingAnchor),
        guide.trailingAnchor.constraint(equalTo: trailingAnchor),
        guide.heightAnchor.constraint(equalToConstant: 1)
    ])
}

override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
    super.didUpdateFocus(in: context, with: coordinator)
    
    // When focus leaves the search bar going down, guide it to the first RN child
    if let nextView = context.nextFocusedView, rnContentContainer.isDescendant(of: self) {
        focusGuide?.preferredFocusEnvironments = [rnContentContainer]
    }
}
```

e) Modify `setupView()` to add the RN container and focus guide when in input mode:
```swift
private func updateLayoutForMode() {
    if mode == "input" {
        if rnContentContainer.superview == nil {
            addSubview(rnContentContainer)
            rnContentContainer.backgroundColor = .clear
            setupFocusGuide()
        }
    } else {
        rnContentContainer.removeFromSuperview()
    }
    setNeedsLayout()
}
```

### 3. `ExpoTvosSearchModule.swift` (215 lines)

**Change**: Add the `mode` prop:
```swift
Prop("mode") { (view: ExpoTvosSearchView, mode: String) in
    view.mode = mode
}
```

### 4. `src/index.tsx` (532 lines)

**Change**: Add `mode` to `TvosSearchViewProps` and make `results` optional when mode is "input":
```tsx
export interface TvosSearchViewProps {
  // ... existing props ...
  
  /**
   * Operating mode for the search view.
   * - 'search' (default): Full search experience with native results grid
   * - 'input': Search bar only — renders children as React Native content below
   */
  mode?: 'search' | 'input';
  
  /**
   * React Native children rendered below the search bar.
   * Only used when mode='input'.
   */
  children?: React.ReactNode;
  
  // Make results optional (required only in search mode)
  results?: SearchResult[];
  
  // Make onSelectItem optional (not needed in input mode)
  onSelectItem?: (event: SelectItemEvent) => void;
}
```

### 5. `expo-module.config.json` — No changes needed

### 6. `package.json` — Bump version

## Risk Areas & Mitigations

### Risk 1: Focus Engine Won't Bridge
**Symptom**: Focus gets "stuck" in the search bar, can't navigate down to RN content.
**Mitigation**: UIFocusGuide between search bar and RN container. If that fails, we can try `TVFocusGuideView` from React Native side.
**Fallback**: Use `preferredFocusEnvironments` override on the ExpoView to explicitly direct focus.

### Risk 2: Search Bar Height Varies
**Symptom**: RN content overlaps the keyboard or has a gap.
**Mitigation**: Start with `searchBarHeight = 140` (empirically observed on tvOS). Make it configurable via a `searchBarHeight` prop. Can also calculate dynamically from the hosting controller's safe area insets.

### Risk 3: RN Children Not Receiving Touch/Focus Events
**Symptom**: Children render but aren't interactive.
**Mitigation**: Ensure `rnContentContainer.isUserInteractionEnabled = true` and children have `isFocusable = true`. The gesture handler toggling already in the library handles the RN/native conflict.

### Risk 4: layoutSubviews Called Too Early
**Symptom**: Children haven't been added yet when layoutSubviews fires.
**Mitigation**: React Native adds children asynchronously. Use `didAddSubview` to detect new children and move them to the container, rather than relying solely on `layoutSubviews`.

```swift
override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    if mode == "input" && subview !== hostingController?.view && subview !== rnContentContainer {
        rnContentContainer.addSubview(subview)
    }
}
```

## Implementation Steps

1. Fork `keiver/expo-tvos-search` to `hassoncs/expo-tvos-search`
2. Clone fork locally, create `feat/input-mode` branch
3. Modify `SearchViewModel` — add `mode` property
4. Modify `TvosSearchContentView.swift` — conditional body based on mode
5. Modify `ExpoTvosSearchView.swift` — add RN container, layoutSubviews, focus guide
6. Modify `ExpoTvosSearchModule.swift` — add mode prop
7. Modify `src/index.tsx` — add mode prop, make results/onSelectItem optional, add children
8. Push to fork
9. Install in radmedia: `npm install expo-tvos-search@github:hassoncs/expo-tvos-search#feat/input-mode`
10. Update `ai.tsx` to use `<TvosSearchView mode="input">`
11. Run `npm run prebuild:tv` to regenerate native project
12. Build and test on physical Apple TV

## JS Usage (Target)

```tsx
import { TvosSearchView } from 'expo-tvos-search';

export default function AiScreen() {
  const handleSearch = (e) => {
    const text = e.nativeEvent.query;
    // Process voice command / typed text
    remoteBridgeService.sendNotification('input.text', { text });
  };

  return (
    <TvosSearchView
      mode="input"
      placeholder="Say a command..."
      colorScheme="dark"
      topInset={140}
      onSearch={handleSearch}
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
    >
      {/* Your custom React Native content */}
      <View style={styles.header}>
        <Text style={styles.title}>Radbot</Text>
      </View>
      <View style={styles.statusCard}>
        {STATUS_ROWS.map(row => <StatusRow key={row.label} {...row} />)}
      </View>
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map(action => <QuickAction key={action.label} {...action} />)}
      </View>
    </TvosSearchView>
  );
}
```

## Success Criteria

1. Inline keyboard with mic button appears (no Siri popup)
2. Dictated text appears in the search field as you speak
3. `onSearch` fires with the dictated/typed text
4. React Native children render below the search bar
5. Focus can navigate from search bar down to RN children and back
6. The RN children are fully interactive (focusable, pressable)
