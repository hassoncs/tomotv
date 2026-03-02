# Option B (Fallback): Minimal Native Search Bar Module

Use this plan if Option A (forking expo-tvos-search) fails due to focus engine issues, SwiftUI layout conflicts, or the RN children container pattern not working reliably on tvOS.

## Goal

Create a minimal Expo native module that provides ONLY the tvOS inline keyboard + mic button as a fixed-height "header" view. The rest of the screen is owned entirely by React Native — no mixing of SwiftUI content with RN children inside the same native view.

## Why This Would Be Needed

Option A tries to mix SwiftUI (the .searchable keyboard) and React Native children inside the same ExpoView. If the focus engine doesn't cooperate (can't bridge focus between SwiftUI and RN, or the keyboard layout breaks), this cleaner separation avoids those issues entirely.

## Architecture

```
┌─────────────────────────────────────────┐
│  React Native View (flex: 1)            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  <TvosSearchBar />               │  │ ← Native module (fixed height)
│  │  height: ~100pt                   │  │   Only the keyboard + mic
│  │  SwiftUI .searchable             │  │   Fires onSearch event
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  <View style={{ flex: 1 }}>      │  │ ← Pure React Native
│  │                                   │  │
│  │  Your custom content here         │  │
│  │  - Status cards                   │  │
│  │  - Quick actions                  │  │
│  │  - SDUI canvas                    │  │
│  │  - Anything                       │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Key difference from Option A: the native module and RN content are SIBLINGS, not parent/child. Focus management is handled by React Native's own focus engine between the two.

## Module Structure

```
modules/expo-tvos-searchbar/
├── ios/
│   ├── expo-tvos-searchbar.podspec
│   ├── ExpoTvosSearchBarModule.swift
│   └── ExpoTvosSearchBarView.swift
├── src/
│   └── index.tsx
├── expo-module.config.json
└── package.json
```

## Implementation Details

### ExpoTvosSearchBarView.swift (~150 lines)

The key insight: we use SwiftUI's `.searchable` but make the content area empty (Color.clear). The native view has a FIXED height — just enough for the keyboard row. React Native handles everything below.

```swift
import ExpoModulesCore
import SwiftUI

#if os(tvOS)

class SearchBarViewModel: ObservableObject {
    @Published var searchText: String = ""
    @Published var placeholder: String = "Search..."
    var onSearch: ((String) -> Void)?
}

struct SearchBarContentView: View {
    @ObservedObject var viewModel: SearchBarViewModel
    
    var body: some View {
        NavigationView {
            Color.clear // Empty content — RN handles everything below
                .searchable(text: $viewModel.searchText, prompt: viewModel.placeholder)
                .onChange(of: viewModel.searchText) { newValue in
                    viewModel.onSearch?(newValue)
                }
        }
    }
}

class ExpoTvosSearchBarView: ExpoView {
    private var hostingController: UIHostingController<SearchBarContentView>?
    private var viewModel = SearchBarViewModel()
    private var gestureHandlersDisabled = false
    
    // Copy the gesture handler management from expo-tvos-search
    // (RCTTVDisableGestureHandlersCancelTouchesNotification etc.)
    
    let onSearch = EventDispatcher()
    let onFocus = EventDispatcher()
    let onBlur = EventDispatcher()
    
    var placeholder: String = "Search..." {
        didSet { viewModel.placeholder = placeholder }
    }
    
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        
        viewModel.onSearch = { [weak self] query in
            self?.onSearch(["query": query])
        }
        
        let contentView = SearchBarContentView(viewModel: viewModel)
        let controller = UIHostingController(rootView: contentView)
        controller.view.backgroundColor = .clear
        hostingController = controller
        
        addSubview(controller.view)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            controller.view.topAnchor.constraint(equalTo: topAnchor),
            controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
            controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])
        
        // Setup text field focus observers (copy from expo-tvos-search)
        NotificationCenter.default.addObserver(self, selector: #selector(handleTextFieldDidBeginEditing), name: UITextField.textDidBeginEditingNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleTextFieldDidEndEditing), name: UITextField.textDidEndEditingNotification, object: nil)
    }
    
    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let controller = hostingController else { return }
        if window != nil {
            if controller.parent == nil, let parentVC = parentViewController() {
                parentVC.addChild(controller)
                controller.didMove(toParent: parentVC)
            }
        } else {
            controller.willMove(toParent: nil)
            controller.removeFromParent()
        }
    }
    
    // Copy parentViewController(), handleTextFieldDidBeginEditing, 
    // handleTextFieldDidEndEditing, gesture handler management
    // from expo-tvos-search ExpoTvosSearchView.swift
}
#endif
```

### ExpoTvosSearchBarModule.swift (~30 lines)

```swift
import ExpoModulesCore

public class ExpoTvosSearchBarModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoTvosSearchBar")
        
        View(ExpoTvosSearchBarView.self) {
            Events("onSearch", "onFocus", "onBlur")
            
            Prop("placeholder") { (view: ExpoTvosSearchBarView, text: String) in
                view.placeholder = text
            }
        }
    }
}
```

### src/index.tsx (~40 lines)

```tsx
import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { Platform, ViewStyle } from 'react-native';

export interface SearchBarEvent {
  nativeEvent: { query: string };
}

export interface TvosSearchBarProps {
  placeholder?: string;
  onSearch: (event: SearchBarEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: ViewStyle;
}

let NativeView: React.ComponentType<TvosSearchBarProps> | null = null;

if (Platform.OS === 'ios' && Platform.isTV) {
  try {
    NativeView = requireNativeViewManager('ExpoTvosSearchBar');
  } catch (e) {
    console.warn('[expo-tvos-searchbar] Failed to load native module');
  }
}

export function TvosSearchBar(props: TvosSearchBarProps) {
  if (!NativeView) return null;
  return <NativeView {...props} />;
}

export function isSearchBarAvailable(): boolean {
  return NativeView !== null;
}
```

### Usage in ai.tsx

```tsx
import { TvosSearchBar } from 'expo-tvos-searchbar';

export default function AiScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Native search bar — fixed height, provides keyboard + mic */}
      <TvosSearchBar
        placeholder="Say a command..."
        onSearch={(e) => handleCommand(e.nativeEvent.query)}
        style={{ height: 100 }}
      />
      
      {/* Pure React Native content below */}
      <ScrollView style={{ flex: 1 }}>
        <StatusCards />
        <QuickActions />
        <SduiCanvas />
      </ScrollView>
    </View>
  );
}
```

## Key Differences from Option A

| Aspect | Option A (Fork) | Option B (New Module) |
|--------|----------------|----------------------|
| Native module | Fork of expo-tvos-search | New minimal module |
| RN children | Inside native view | Sibling to native view |
| Focus bridging | UIFocusGuide (complex) | RN focus engine (simpler) |
| Search bar height | Dynamic (part of full view) | Fixed height prop |
| Keyboard behavior | Full-screen search experience | Just the keyboard row |
| Effort | ~2-3 hours | ~4-5 hours |
| Risk | Focus bridging may not work | Keyboard may not position correctly with fixed height |
| Maintenance | Fork stays close to upstream | Separate module to maintain |

## Risks & Mitigations

### Risk 1: .searchable Doesn't Work in Fixed-Height View
The `.searchable` modifier expects to be in a NavigationView that owns the full screen. Constraining it to a fixed height may break the keyboard positioning.
**Mitigation**: Don't constrain the native view height — let it fill the screen, but make the content area transparent. Position RN content as an overlay on top of the transparent area using `position: 'absolute'`.

### Risk 2: Focus Can't Leave the Native View
If the native search bar captures focus and the RN content is a sibling, focus may not leave the native view.
**Mitigation**: Use `TVFocusGuideView` from React Native to create a focus bridge between the native view and the RN content below.

### Risk 3: Keyboard Row Covers RN Content
On tvOS, the keyboard slides to the left side and results appear on the right. With a fixed-height search bar, this may not work.
**Mitigation**: Accept the full-height keyboard behavior but use `pointerEvents="none"` on the transparent area of the native view so RN content underneath receives touches.

## When to Use This

- Option A focus bridging fails after 2+ attempts
- The SwiftUI .searchable content area refuses to be transparent/empty cleanly
- layoutSubviews child hijacking doesn't work reliably (children flicker, disappear, or lose focus)
- Build/linking issues with the forked library that can't be resolved quickly
