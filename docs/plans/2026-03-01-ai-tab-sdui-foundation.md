# AI Tab + SDUI Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move SDUI from always-on overlay to an AI tab canvas, keep toast-style notifications as overlays, reuse existing media UI components, and complete the select-to-action loop.

**Architecture:** Split SDUI rendering into two surfaces: `overlay` (Toast only) and `canvas` (AI tab content). Keep the existing `componentRegistry` as the single dispatch point, but carry render metadata (`target`, `navigateToTab`) so the app can route content appropriately. Consolidate duplicated SDUI media displays into one `MediaGrid` component that wraps existing `VideoGridItem` patterns.

**Tech Stack:** Expo Router (NativeTabs), React Native tvOS, TypeScript, Zod, JSON-RPC bridge handlers, Jest + react-test-renderer.

---

## Scope and Non-Goals

### In Scope (MVP)
- Replace Help tab with AI tab.
- Add AI tab screen as SDUI canvas host.
- Keep Toast as overlay; route all rich components to AI tab.
- Rename `TextMessage` -> `Toast` (component + registry + skill docs).
- Consolidate `MovieGrid` and `SearchResults` into reusable `MediaGrid`.
- Add selection event loop from UI -> bridge (`event.ui.select`, `event.ui.action`).
- Add `ConfirmationCard`, `InfoCard`, `EpisodeList` as first new canvas components.

### Out of Scope (defer)
- ContinueWatchingShelf.
- HomeStatusCard / SceneSelector.
- Queue editing UI.
- Full download orchestration UX.

---

## API Contracts (Define Before UI Work)

### 1) Extended `ui.render` request params
Current:
```ts
{ component: string; props?: Record<string, unknown> }
```

New:
```ts
{
  component: string;
  props?: Record<string, unknown>;
  target?: 'overlay' | 'canvas'; // default: 'canvas'
  navigateToTab?: boolean;       // default: true when target='canvas'
}
```

### 2) New bridge event notifications (app -> relay)
- `event.ui.select`
```ts
{
  component: string;
  itemId: string;
  itemType?: string;
  title?: string;
}
```

- `event.ui.action`
```ts
{
  component: string;
  actionId: string;
  value?: string;
}
```

- `event.ui.dismiss`
```ts
{
  component?: string;
  source: 'overlay' | 'canvas';
}
```

### 3) SDUI component naming
- `TextMessage` -> `Toast` (keep temporary alias during migration window).

---

## Task 1: Add Bridge Types and Protocol Support

**Files:**
- Modify: `tomotv/bridge/types.ts`
- Modify: `tomotv/bridge/protocol.ts`
- Modify: `tomotv/services/componentRegistry.ts`
- Test: `tomotv/bridge/__tests__/protocol.ui-events.test.ts`

**Step 1: Write failing protocol test**
- Add tests for parsing:
  - `ui.render` with new optional `target` and `navigateToTab`
  - new event method names (`event.ui.select`, `event.ui.action`, `event.ui.dismiss`)

**Step 2: Run test to verify it fails**
- Run: `npm test -- protocol.ui-events.test.ts`
- Expected: parse failures / unknown method failures.

**Step 3: Implement minimal protocol changes**
- Extend `BridgeEventMethod` union in `bridge/types.ts`.
- Add Zod schemas and maps in `bridge/protocol.ts`.
- Keep defaults backward-compatible.

**Step 4: Run tests**
- Run: `npm test -- protocol.ui-events.test.ts`
- Expected: PASS.

**Step 5: Commit**
- `feat(bridge): add ui event contracts and render target params`

---

## Task 2: Extend Component Registry Dispatch Metadata

**Files:**
- Modify: `tomotv/services/componentRegistry.ts`
- Test: `tomotv/services/__tests__/componentRegistry.dispatch.test.ts`

**Step 1: Write failing test**
- Test `dispatchRender` supports metadata:
  - `target` defaults to `canvas`
  - `navigateToTab` defaults to true for canvas
  - listeners receive `{ name, props, target, navigateToTab }`

**Step 2: Run failing test**
- Run: `npm test -- componentRegistry.dispatch.test.ts`

**Step 3: Implement registry update**
- Introduce `SduiRenderPayload` type.
- Update listener signatures and dispatch API.

**Step 4: Run tests**
- `npm test -- componentRegistry.dispatch.test.ts`

**Step 5: Commit**
- `refactor(sdui): add render payload metadata to registry dispatch`

---

## Task 3: Add AI Tab and Replace Help Tab

**Files:**
- Modify: `tomotv/app/(tabs)/_layout.tsx`
- Add: `tomotv/app/(tabs)/ai.tsx`
- Keep (unchanged for now): `tomotv/app/(tabs)/help.tsx`
- Test: `tomotv/app/(tabs)/__tests__/tabs.ai-route.test.tsx`

**Step 1: Write failing tab test**
- Assert tabs include `ai` and do not include `help` trigger.

**Step 2: Run test and confirm fail**
- `npm test -- tabs.ai-route.test.tsx`

**Step 3: Implement tab swap**
- Replace trigger:
  - `name="help"` -> `name="ai"`
  - Label: `AI`
  - Icon: `sparkles` (or `brain.head.profile`, pick one and standardize).
- Add `ai.tsx` with:
  - empty state
  - SDUI render subscription
  - canvas component stack rendering

**Step 4: Run tests**
- `npm test -- tabs.ai-route.test.tsx`

**Step 5: Commit**
- `feat(nav): replace Help tab with AI tab canvas`

---

## Task 4: Split Overlay vs Canvas Routing

**Files:**
- Modify: `tomotv/app/_layout.tsx`
- Modify: `tomotv/app/sdui.tsx` (overlay host)
- Modify: `tomotv/app/(tabs)/ai.tsx`
- Test: `tomotv/app/__tests__/sdui-routing.test.tsx`

**Step 1: Write failing routing test**
- On render payload:
  - `target='overlay'` -> do not navigate tabs, render in overlay host
  - `target='canvas'` + `navigateToTab=true` -> navigate to `/(tabs)/ai`

**Step 2: Run failing test**
- `npm test -- sdui-routing.test.tsx`

**Step 3: Implement routing logic**
- In root layout render listener:
  - if `target==='canvas'` then `router.push('/(tabs)/ai')`
  - if overlay, keep current screen.
- Update overlay screen to only show overlay-target components.

**Step 4: Run tests**
- `npm test -- sdui-routing.test.tsx`

**Step 5: Commit**
- `feat(sdui): route canvas renders to AI tab and isolate overlays`

---

## Task 5: Rename TextMessage to Toast (with Alias)

**Files:**
- Rename: `tomotv/components/sdui/TextMessage.tsx` -> `tomotv/components/sdui/Toast.tsx`
- Modify: `tomotv/components/sdui/registerComponents.ts`
- Modify: `tomotv/chrisbot/skills/tomotv-control/SKILL.md`
- Test: `tomotv/components/sdui/__tests__/toast.schema.test.ts`

**Step 1: Write failing test**
- Manifest exposes `Toast`.
- `TextMessage` still accepted temporarily as alias.

**Step 2: Run failing test**
- `npm test -- toast.schema.test.ts`

**Step 3: Implement rename + alias**
- Register `Toast` as primary.
- Register `TextMessage` alias pointing same component for backward compatibility.
- Mark alias as deprecated in description.

**Step 4: Run tests**
- `npm test -- toast.schema.test.ts`

**Step 5: Commit**
- `refactor(sdui): rename TextMessage to Toast with compatibility alias`

---

## Task 6: Build Reusable MediaGrid and Remove Duplication

**Files:**
- Add: `tomotv/components/sdui/MediaGrid.tsx`
- Modify: `tomotv/components/sdui/registerComponents.ts`
- Deprecate/remove: `tomotv/components/sdui/MovieGrid.tsx`
- Deprecate/remove: `tomotv/components/sdui/SearchResults.tsx`
- Test: `tomotv/components/sdui/__tests__/media-grid.test.tsx`

**Step 1: Write failing component test**
- `MediaGrid` renders items using app-standard card behavior.
- pressing item triggers selection callback with `item.Id`.

**Step 2: Run failing test**
- `npm test -- media-grid.test.tsx`

**Step 3: Implement minimal MediaGrid**
- Props schema accepts `items: JellyfinVideoItem[]`, `title?`, `columns?`.
- Reuse card patterns from `VideoGridItem` behavior (or wrap `VideoGridItem` directly).
- Do not invent `posterUrl` field; derive via existing services as app does.

**Step 4: Run tests**
- `npm test -- media-grid.test.tsx`

**Step 5: Commit**
- `feat(sdui): add reusable MediaGrid and remove duplicate movie/search components`

---

## Task 7: Implement UI Event Emission from SDUI Components

**Files:**
- Modify: `tomotv/services/remoteBridgeService.ts`
- Modify: `tomotv/components/sdui/MediaGrid.tsx`
- Add: `tomotv/components/sdui/ConfirmationCard.tsx`
- Add: `tomotv/components/sdui/InfoCard.tsx`
- Add: `tomotv/components/sdui/EpisodeList.tsx`
- Modify: `tomotv/components/sdui/registerComponents.ts`
- Test: `tomotv/services/__tests__/remoteBridge.ui-events.test.ts`

**Step 1: Write failing service test**
- Verify service can send JSON-RPC notifications for:
  - `event.ui.select`
  - `event.ui.action`
  - `event.ui.dismiss`

**Step 2: Run failing test**
- `npm test -- remoteBridge.ui-events.test.ts`

**Step 3: Implement event API**
- Add explicit methods on `remoteBridgeService`:
  - `emitUiSelect(payload)`
  - `emitUiAction(payload)`
  - `emitUiDismiss(payload)`
- Use shared schema validation before send.

**Step 4: Wire component callbacks**
- `MediaGrid` item press -> emit select + optional local navigation behavior.
- `ConfirmationCard` buttons -> emit action (`confirm`/`cancel`).
- `InfoCard` buttons -> emit action with actionId.
- `EpisodeList` row press -> emit select for episode ID.

**Step 5: Run tests**
- `npm test -- remoteBridge.ui-events.test.ts`

**Step 6: Commit**
- `feat(sdui): emit structured ui events for selections and actions`

---

## Task 8: Wire Bot Skill Docs and Examples

**Files:**
- Modify: `chrisbot/skills/tomotv-control/SKILL.md`
- Modify: `tomotv/docs/sdui-component-audit.md`

**Step 1: Update component list**
- Replace `TextMessage` with `Toast`.
- Replace `MovieGrid`/`SearchResults` with `MediaGrid`.
- Add `ConfirmationCard`, `InfoCard`, `EpisodeList` with example payloads.

**Step 2: Add event loop examples**
- Show `event.ui.select` handling examples with `tommo play <id>`.

**Step 3: Commit**
- `docs(sdui): update component contracts and event-driven interaction flow`

---

## Verification Matrix (Must Pass Before Merge)

### Unit / Integration
- `npm test -- protocol.ui-events.test.ts`
- `npm test -- componentRegistry.dispatch.test.ts`
- `npm test -- tabs.ai-route.test.tsx`
- `npm test -- sdui-routing.test.tsx`
- `npm test -- toast.schema.test.ts`
- `npm test -- media-grid.test.tsx`
- `npm test -- remoteBridge.ui-events.test.ts`
- `npm test`

### Type and lint
- `npx tsc --noEmit`
- `npm run lint`

### Manual smoke checks (tvOS simulator)
1. App opens with tabs: Library, Search, Settings, AI.
2. `tommo ui:render` Toast appears as overlay and auto-dismisses.
3. `tommo ui:render` MediaGrid routes to AI tab and displays cards.
4. Selecting MediaGrid item emits `event.ui.select` and/or starts playback.
5. ConfirmationCard emits confirm/cancel events.
6. InfoCard renders text+image and action buttons.
7. EpisodeList supports episode selection and emits expected payload.

---

## Rollout Checkpoints

### Checkpoint A: Navigation Foundation
- AI tab exists and is stable.
- Overlay/canvas split works.

### Checkpoint B: Component Contract Migration
- Toast rename complete with alias.
- MediaGrid available and old components deprecated.

### Checkpoint C: Interaction Loop Complete
- `event.ui.select` / `event.ui.action` emitted and observed in relay logs.
- Bot can respond to selection by playing media.

### Checkpoint D: Feature Completeness
- ConfirmationCard, InfoCard, EpisodeList functional.
- Docs and skill examples updated.

---

## Acceptance Criteria

1. Help tab is removed; AI tab is present and is the default canvas for SDUI rich content.
2. Toast is the only overlay-style message component (TextMessage alias still works during migration).
3. There is one reusable SDUI media browser component (`MediaGrid`) that uses app-consistent item UI and data shape.
4. Selecting SDUI items/actions produces structured bridge events (`event.ui.select`, `event.ui.action`).
5. The bot can reliably turn those events into follow-up commands (e.g., play selected media).
6. New components (`ConfirmationCard`, `InfoCard`, `EpisodeList`) are renderable via `tommo ui:render` and validated by Zod schemas.
7. Type check, lint, and test suite pass.

---

## Risks and Mitigations

- **Risk:** Break existing bot prompts that call `TextMessage`, `MovieGrid`, or `SearchResults`.
  - **Mitigation:** Keep temporary aliases and document deprecation path.

- **Risk:** Focus behavior regressions on tvOS in AI tab.
  - **Mitigation:** Add focus-specific tests and manual D-pad verification checklist.

- **Risk:** Event spam or malformed payloads.
  - **Mitigation:** validate all outbound event payloads with Zod before send.

---

## Suggested Commit Sequence

1. `feat(bridge): add ui event contracts and render target params`
2. `refactor(sdui): add render payload metadata to registry dispatch`
3. `feat(nav): replace Help tab with AI tab canvas`
4. `feat(sdui): route canvas renders to AI tab and isolate overlays`
5. `refactor(sdui): rename TextMessage to Toast with compatibility alias`
6. `feat(sdui): add reusable MediaGrid and remove duplicate movie/search components`
7. `feat(sdui): emit structured ui events for selections and actions`
8. `docs(sdui): update component contracts and event-driven interaction flow`
