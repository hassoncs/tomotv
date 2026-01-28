# Lessons Learned

**Last Updated:** January 27, 2026

## Quick Reference
**Category:** Implementation
**Keywords:** debugging, bugs, lessons, case studies, audio tracks, HLS, platform behavior, compliance tests, anti-patterns

Case studies of significant bugs encountered during TomoTV development with root causes, solutions, and key takeaways.

## Related Documentation
- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - Lessons inform best practices
- [`CLAUDE-multi-audio.md`](./CLAUDE-multi-audio.md) - Audio track debugging cases

---

This document captures important lessons from debugging sessions, bugs, and issues encountered during TomoTV development. Each lesson reinforces the workflow and decision-making rules in the main CLAUDE.md.

---

## Audio Track Label Bug (January 2026)

### Problem
tvOS showed "Unknown language" instead of track name for undefined language tracks in the native audio picker.

### Root Cause
iOS/tvOS **ALWAYS prioritizes LANGUAGE attribute** over NAME for display in native picker. When LANGUAGE="und" (undefined), iOS displays its own localized string "Unknown language" regardless of what NAME says.

### Solution
Omit LANGUAGE attribute entirely for "und" tracks. Per RFC 8216, LANGUAGE is OPTIONAL. When LANGUAGE is omitted, iOS falls back to displaying the NAME attribute.

### What Went Wrong
- ❌ Proposed solutions without reading Apple HLS spec
- ❌ Assumed LANGUAGE was required (it's optional per RFC 8216)
- ❌ Went in circles trying NAME variations without understanding root cause
- ❌ Forgot platform context (iOS HLS ≠ generic HLS)
- ❌ Didn't read the actual Swift implementation before suggesting changes

### What Worked
- ✅ Read RFC 8216 to confirm LANGUAGE is optional
- ✅ Read Apple HLS Authoring Specification
- ✅ Inspected actual Swift code in `native/ios/MultiAudioResourceLoader/`
- ✅ Tested one solution at a time with clear hypothesis
- ✅ Asked user for confirmation before implementing

### Key Takeaways
1. **Display and auto-selection are separate concerns:**
   - LANGUAGE/NAME control what's displayed in picker
   - DEFAULT/AUTOSELECT control which track plays automatically
2. **Platform-specific behavior requires platform-specific documentation:**
   - Generic HLS specs (RFC 8216) define what's allowed
   - Apple HLS implementation defines actual behavior on iOS/tvOS
3. **Read implementation code BEFORE proposing solutions:**
   - Assumptions about how code works are often wrong
   - 5 minutes reading Swift code saves hours of iteration

### Files Affected
- `native/ios/MultiAudioResourceLoader/HLSManifestGenerator.swift:156-180`

### Commit
- Hash: 703c7a2
- Message: "fix: audio tracks show correct name, no default selected mark in list tradeoff"

---

## Compliance Test Anti-Pattern (January 2026)

### Problem
AI-generated tests sometimes use `fs.readFileSync` to scan source code files and assert on string presence/absence, rather than testing actual runtime behavior. These "compliance tests" provide false confidence and test nothing meaningful.

### Root Cause
When asked to verify a code property (e.g., "ensure no console.log statements"), the path of least resistance is to read the source file and check for string patterns. This satisfies the request superficially but doesn't exercise any code paths.

### Solution
Established a rule: **all tests must exercise actual code paths.** If the only way to verify something is scanning source text, use a linter rule instead or skip the test entirely. No test is better than a fake test.

### What Went Wrong
- ❌ Used `fs.readFileSync` in test files to scan source code
- ❌ Asserted on code text patterns instead of runtime behavior
- ❌ Created tests that pass/fail based on string matching, not functionality
- ❌ Provided false confidence that "everything is tested"

### What Worked
- ✅ Identified the anti-pattern and documented it
- ✅ Added explicit rule to testing best practices
- ✅ Audited all existing test files for violations (none found)
- ✅ Clear guidance: use ESLint for code style, Jest for behavior

### Key Takeaways
1. **Tests must exercise code paths:** A test that reads source files is not a test — it's a linter with extra steps
2. **No test > fake test:** If you can't write a meaningful behavioral test, skip it
3. **Right tool for the job:** Use ESLint for code style enforcement, Jest for behavior verification
4. **Question AI-generated tests:** Compliance tests are a common AI failure mode — always review test quality, not just quantity

### Files Affected
- `memories/CLAUDE-testing.md` (added No Compliance Tests rule)
- No existing test files were in violation

---

## False Apple Docs Claim in tvOS Focus Fix (January 2026)

### Problem
Implemented a tvOS focus restoration function based on an unverified claim about Apple's documentation. The code comment stated "Per Apple docs, UIKit rebuilds the focus spatial map when a focusable view is removed from the hierarchy." This claim was false.

### Root Cause
The plan stated an Apple docs fact that was never verified. The implementation was coded, commented, and JSDoc'd with "Per Apple docs" without anyone checking what Apple actually says. What Apple actually says: "UIKit automatically updates focus when a **focused** view is removed from the view hierarchy." The word "focused" is critical — it means the currently-focused view, not any arbitrary focusable view. Additionally, Apple doesn't use the term "spatial map" at all.

### Solution
Caught the error when the user asked for verification. Research confirmed the claim was false. The implementation (adding/removing a non-focused temporary focusable view) is almost certainly a no-op — UIKit has no reason to do anything when a view that never had focus is removed.

### What Went Wrong
- ❌ Implemented a plan without verifying its core assumption
- ❌ Wrote "Per Apple docs" in code comments without reading Apple docs
- ❌ Treated the plan's assertion as fact and coded it without due diligence
- ❌ The plan itself had ~50% confidence but the code comments stated it as documented fact
- ❌ Violated the Research-First Protocol from CLAUDE.md

### What Worked
- ✅ User asked a direct yes/no verification question
- ✅ Fetched actual Apple documentation (App Programming Guide for tvOS, WWDC 2016/2017 transcripts)
- ✅ Found the exact discrepancy: "focused view" vs "any focusable view"
- ✅ Admitted the error immediately and transparently

### Key Takeaways
1. **Never write "Per docs" without reading the docs:** If a plan claims something is documented, verify it before implementing. "Per Apple docs" in a code comment is a factual assertion — treat it with the same rigor as a test assertion.
2. **Verify facts from plans the same way you'd verify facts from memory:** A plan written by an AI is not a primary source. It can be wrong. The plan said "Per Apple docs" but had never checked.
3. **Low-confidence plans need higher verification, not lower:** The plan stated ~50% confidence. That should have triggered MORE verification, not less.
4. **The Research-First Protocol exists for a reason:** CLAUDE.md says "NEVER propose solutions based on assumptions alone." This applies to implementing plans too — the plan was the assumption.

### Files Affected
- `@keiver/expo-tvos-search/ios/ExpoTvosSearchModule.swift` (incorrect implementation)
- `@keiver/expo-tvos-search/src/index.tsx` (incorrect JSDoc)

---

## tvOS Focus Engine Research Findings (January 2026)

### Problem
tvOS up/down traversal breaks after player modal dismissal. Focus visual is correct, left/right works, but vertical navigation is completely broken across all tabs.

### Root Cause (Unconfirmed — debug data needed)
react-native-screens has zero tvOS focus code. The `afterTransitions` block in `RNSScreenStack.mm:629` runs after modal dismiss but only updates window traits (status bar, orientation). No focus restoration is performed. The Android equivalent was fixed in PR #1894 by saving/restoring `lastFocusedChild`. tvOS was never fixed.

### Key Findings From Research
1. **UIKit's `restoresFocusAfterTransition` (default YES) handles focus POSITION** — and it works (visual is correct). The bug is about TRAVERSAL, which is a separate system.
2. **`setNeedsFocusUpdate()` controls WHERE focus goes, not traversal** — This is why v1/v2 attempts moved focus but didn't fix the problem.
3. **`RCTScrollViewComponentView.shouldUpdateFocusInContext` blocks vertical movement** when `context.nextFocusedItem` is nil or fails the containment check (`RCTScrollViewComponentView.mm:1181`). This could be the mechanism that blocks vertical traversal.
4. **Fabric is missing `didMoveToSuperview` focus guide lifecycle** — `RCTTVView.m` (Old Arch) restores focus guide state when views are reattached; `RCTViewComponentView.mm` (Fabric) does not.
5. **Apple's 4 automatic focus update triggers:** focused view removed, table/collection reloads, new VC presented, Menu button. None of these trigger a general "spatial map rebuild."

### What Went Wrong
- ❌ Attempted multiple fixes without understanding the root cause
- ❌ Conflated focus POSITION (where focus lands) with focus TRAVERSAL (ability to navigate)
- ❌ Assumed `setNeedsFocusUpdate()` rebuilds the focus engine's spatial understanding
- ❌ Implemented a fix based on a false documentation claim

### What Should Happen Next
- ✅ Enable `-UIFocusLoggingEnabled` and debug with UIFocusDebugger to identify exact failure point
- ✅ Check if `context.nextFocusedItem` is nil during vertical swipes after modal dismiss
- ✅ Check if `shouldUpdateFocusInContext` returns NO on a scroll view
- ✅ Apply targeted fix based on actual debug data

### Key Takeaways
1. **Focus position and focus traversal are different systems** — restoring position doesn't fix traversal
2. **Debug before fixing** — Without knowing if the problem is in the focus engine, scroll view, or focus guides, any fix is a guess
3. **Read the actual native code** — react-native-screens, react-native-tvos, and Apple's APIs all interact. Understanding the code paths is essential.
4. **Fabric (New Arch) has different focus behavior than Old Arch** — Missing lifecycle methods in `RCTViewComponentView.mm` may contribute to focus bugs

### Files Relevant
- `node_modules/react-native-screens/ios/RNSScreenStack.mm:629` (afterTransitions block)
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/ScrollView/RCTScrollViewComponentView.mm:1155` (shouldUpdateFocusInContext)
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm` (missing didMoveToSuperview)
- `node_modules/react-native/React/Views/RCTTVView.m:258` (Old Arch didMoveToSuperview with focus guide restoration)

---

## Template for Future Lessons

When adding new lessons, use this format:

```markdown
## [Issue Title] ([Month Year])

### Problem
[1-2 sentence description of user-facing issue]

### Root Cause
[Technical explanation of why it happened]

### Solution
[What fixed it]

### What Went Wrong
- ❌ [Anti-pattern we fell into]
- ❌ [Assumption we made]

### What Worked
- ✅ [Process that led to solution]
- ✅ [Tool or technique that helped]

### Key Takeaways
1. [Lesson 1]
2. [Lesson 2]

### Files Affected
- [file:line]

### Commit
- Hash: [commit hash]
- Message: "[commit message]"
```
