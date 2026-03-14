# APInox Android + iOS Mobile Support Plan

> **Branch:** `feature/mobile-android-ios`  
> **Build machine:** Mac (builds both Android and iOS from a single machine)

---

## Problem Statement

APInox is currently a desktop-only Tauri application with no mobile support, fixed 1400×900 minimum dimensions, and a sidebar-heavy layout that won't work on portrait phone screens. Tauri 2 (v2.10.3, which is already installed) has stable Android and iOS support. The app's Rust-native architecture means most business logic should port well — the main work is the build environment setup, plugin compatibility fixes, and a fully responsive UI.

**Build matrix (unchanged for desktop):**

| Platform | Build machine |
|----------|--------------|
| Windows desktop | Windows |
| Linux desktop | Linux |
| macOS desktop | Mac |
| Android | Mac |
| iOS | Mac |

**Goals:**
- Android + iOS mobile targets, both built from Mac — desktop build machines are unchanged
- Full feature parity
- Split-screen sidebar on tablet, drawer/slide-over on phone (portrait)

---

## Current State Summary

- **Tauri**: 2.10.3 (Android/iOS capable)
- **Architecture**: Pure Rust backend + React webview (no separate Node.js backend process)
- **Mobile entry point**: `#[cfg_attr(mobile, tauri::mobile_entry_point)]` already in `src-tauri/src/lib.rs`
- **Android icons**: Already exist in `src-tauri/icons/android/`
- **Plugins**: 8 Tauri plugins — most have mobile support, 2 need desktop guards
- **UI**: Zero responsive design, fixed desktop layout, `styled-components`
- **Window config**: `minWidth: 800`, `titleBarStyle: "Overlay"`, splashscreen window — all desktop-only

---

## Key Risks / Challenges

| Risk | Severity | Mitigation |
|------|----------|------------|
| `tauri-plugin-decorum` (macOS titlebar) on mobile | High | `#[cfg(desktop)]` guard |
| Android blocks HTTP cleartext (non-HTTPS) | High | Network security config XML |
| File system paths differ on Android | Medium | Use Tauri's `appDataDir()` API |
| `tauri-plugin-process` limited on Android | Low | Already limited use; guard with `#[cfg(desktop)]` |
| Splashscreen second window on mobile | Medium | `#[cfg(desktop)]` window config |
| Certificate installation to system store | Medium | Android-specific: app trust store only |
| Touch target sizes (44px minimum) | Medium | CSS updates |
| Tablet split-view breakpoint detection | Medium | CSS `@media` + Tauri window size API |

---

## Phases

### Phase 1 — Environment Setup (Mac — builds both Android and iOS)

**Prerequisites (install once):**

1. Install **Xcode** from the App Store (latest stable) + CLI tools:
   ```bash
   xcode-select --install
   ```

2. Install **Android Studio** for Mac (download from developer.android.com):
   - In SDK Manager, install:
     - Android SDK Platform **35** (API 35, Android 15) — primary target
     - Android SDK Platform **24** (API 24, Android 7.0) — minimum
     - Android **NDK** (Side by side) — latest LTS (e.g. 26.x or 27.x)
     - Android SDK Build-Tools
     - Android Emulator

3. Set environment variables in `~/.zshrc` (or `~/.bash_profile`):
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export NDK_HOME="$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | sort -V | tail -1)"
   export PATH="$PATH:$ANDROID_HOME/platform-tools"
   ```
   Then: `source ~/.zshrc`

4. Install Rust Android targets:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

5. Install Rust iOS targets:
   ```bash
   rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
   ```

6. Install `cargo-ndk` (required for Android NDK cross-compilation):
   ```bash
   cargo install cargo-ndk
   ```

**Initialize mobile projects** (run once from the APInox repo root):
```bash
npx tauri android init
npx tauri ios init
```
This creates:
- `src-tauri/gen/android/` — Gradle/Android Studio project
- `src-tauri/gen/apple/` — Xcode project

**Development commands:**
```bash
# Android — run on emulator or USB-connected device
npx tauri android dev

# Android — release build (APK/AAB)
npx tauri android build

# iOS — run on simulator or USB-connected device
npx tauri ios dev

# iOS — release build
npx tauri ios build
```

---

### Phase 2 — Plugin & Config Compatibility Fixes

Fix code that will break on mobile before worrying about UI.

**2a. Guard `tauri-plugin-decorum` (macOS title bar)**
- File: `src-tauri/src/lib.rs`
- The decorum plugin sets a custom macOS title bar — will error on Android/iOS
- Wrap initialization with `#[cfg(desktop)]`

**2b. Guard splashscreen window**
- File: `src-tauri/tauri.conf.json` — the second `splashscreen` window entry
- Move splashscreen logic to desktop-only using `#[cfg(desktop)]` in Rust

**2c. Network Security Config (Android HTTP cleartext)**
- Android 9+ blocks HTTP (non-HTTPS) by default
- APInox calls SOAP endpoints that may be HTTP-only
- After `tauri android init`, create `src-tauri/gen/android/app/src/main/res/xml/network_security_config.xml`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <network-security-config>
      <base-config cleartextTrafficPermitted="true" />
  </network-security-config>
  ```
- Reference it in `AndroidManifest.xml`:
  ```xml
  <application android:networkSecurityConfig="@xml/network_security_config" ...>
  ```

**2d. Android Permissions**
- Add to `AndroidManifest.xml`:
  - `INTERNET` (required for all HTTP/SOAP requests)
  - `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` if project files live outside app sandbox

**2e. File Storage Paths**
- Current code may use hardcoded paths like `~/.apinox/`
- On Android, app data lives in `/data/data/app.apinox.dev1/`
- Use Tauri's `path::app_data_dir()` API throughout instead of home-relative paths
- Audit `src-tauri/src/` for hardcoded paths

**2f. Remove/guard desktop-only window config**
- `minWidth: 800`, `minHeight: 600` — must not be set on mobile
- `titleBarStyle: "Overlay"`, `hiddenTitle: true` — desktop only
- Split into platform-specific config or guard in Rust at runtime

**2g. Certificate Installation**
- On Android, apps cannot install to the system certificate store without root
- The "Install Certificate to Local Machine" feature needs an Android-specific path:
  - Install to app's user trust store only
  - Show appropriate messaging to the user
- iOS has its own certificate trust mechanism (provisioning profiles)

---

### Phase 3 — Responsive UI Foundation

Establish the responsive system before implementing specific layouts.

**3a. Breakpoint System**
- Add CSS custom properties / media queries to `src-tauri/webview/src/index.css`:
  ```css
  /* Phone portrait: < 600px */
  /* Phone landscape / small tablet: 600px–899px */
  /* Tablet portrait: 900px–1199px */
  /* Tablet landscape / desktop: ≥ 1200px */
  ```
- Create `src-tauri/webview/src/hooks/useBreakpoint.ts` wrapping `window.matchMedia`
- Create `src-tauri/webview/src/hooks/useMobileLayout.ts` returning `{ isPhone, isTablet, isDesktop }`

**3b. Remove Fixed Window Minimum**
- Remove `minWidth: 800, minHeight: 600` from `tauri.conf.json` (or guard via Rust to only apply on desktop)

**3c. Touch Target Sizes**
- All interactive elements must be ≥ 44px tall (Apple HIG / Material Design minimum)
- Audit `SidebarRail.tsx`, `ServiceTree.tsx`, toolbar components
- Add `min-height: 44px` to interactive elements in shared styles

---

### Phase 4 — Sidebar / Navigation Adaptive Layout

**4a. Phone Portrait — Drawer Pattern**

On phones (`< 900px` width):
- Sidebar hidden off-screen (`transform: translateX(-100%)`)
- Hamburger button visible in the top bar
- Tapping slides sidebar in as an overlay with dimmed backdrop
- Tapping outside or swiping left dismisses it
- Implementation:
  - `isSidebarOpen` state in `App.tsx`
  - CSS transition on `SidebarContainer` for slide animation
  - Backdrop `<div>` overlay when open
  - `@media (max-width: 899px)` switches layout mode

**4b. Tablet — Split-Screen**

On tablets (`≥ 900px` width):
- Existing sidebar-beside-content layout retained
- Collapsed/expanded sidebar rail still works as on desktop
- Sidebar slightly narrower (240px vs 300px) on smaller tablets

**4c. Landscape Phone**
- 600–899px wide: treat like a mini-tablet
- Sidebar collapsed by default, expandable by tapping rail

**4d. Files to Update**
- `src-tauri/webview/src/App.tsx` — top-level layout restructure
- `src-tauri/webview/src/components/Sidebar.tsx` — mobile drawer behaviour
- `src-tauri/webview/src/styles/WorkspaceLayout.styles.ts` — responsive styles
- `src-tauri/webview/src/components/sidebar/SidebarRail.tsx` — hamburger trigger on mobile

---

### Phase 5 — Content Area Adaptations

**5a. Request/Response Split**
- Currently side-by-side horizontal split
- Phone: stack vertically (request on top, response below)
- Tablet portrait: same vertical stack
- Tablet landscape: horizontal split (current behaviour)

**5b. Toolbar / Header**
- Reduce crowding on small screens
- Icon-only buttons on narrow widths; secondary actions in `...` overflow menu

**5c. Modal / Dialog Sizing**
- Modals: `width: min(95vw, 800px)` — scales down on small screens
- `max-height: 90vh; overflow-y: auto` for tall modals on short phones

**5d. Response Viewer**
- XML/code viewer: ensure `overflow-x: auto` so long lines scroll horizontally instead of breaking layout

---

### Phase 6 — Feature Validation on Mobile

**6a. Test Runner (long-running operations)**
- The polling/streaming pattern should work on Android and iOS
- Verify `getTestRunUpdates` and streaming commands

**6b. File Picker (Import/Export)**
- `tauri-plugin-dialog` has Android support (opens Android SAF file picker)
- Verify on device — no code changes expected

**6c. History & Project Storage**
- Ensure project save path uses `appDataDir` (see Phase 2e)
- Auto-discover projects from `appDataDir/projects/` on Android

**6d. Certificate Operations (Android)**
- Install to app trust store only (not system)
- Use `reqwest`'s custom root certificate per-request
- May need a runtime toggle: "Use installed certificate"

---

### Phase 7 — iOS Specific Polish (same Mac)

After Android is working:
- Build and test with `npx tauri ios dev`
- iOS safe area insets (notch / Dynamic Island / home indicator):
  ```css
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  ```
- HTTP cleartext: add `NSAllowsArbitraryLoads` to `Info.plist` (generated by `tauri ios init`)
- App Store review requirements differ from Google Play — review before submitting

---

## Implementation Order (TODO List)

1. **env-mac-android** — Android Studio + SDK + NDK + env vars + Rust Android targets
2. **env-mac-ios** — Xcode CLI tools + Rust iOS targets
3. **tauri-mobile-init** — `tauri android init` + `tauri ios init`
4. **fix-decorum-guard** — `#[cfg(desktop)]` around decorum plugin in `lib.rs`
5. **fix-splashscreen-mobile** — Guard splashscreen window for desktop only
6. **fix-network-security** — Android cleartext HTTP network security config XML
7. **fix-android-permissions** — `AndroidManifest.xml` INTERNET + storage permissions
8. **fix-file-paths** — Audit and fix hardcoded `~/.apinox` paths to use `appDataDir()`
9. **fix-window-config** — Remove/guard `minWidth`, `titleBarStyle`, `hiddenTitle` for mobile
10. **responsive-breakpoints** — CSS breakpoints + `useBreakpoint` + `useMobileLayout` hooks
11. **responsive-touch-targets** — 44px minimum touch targets audit
12. **responsive-sidebar-drawer** — Drawer pattern for phone portrait
13. **responsive-sidebar-tablet** — Split-screen retained for tablets
14. **responsive-content-stack** — Request/Response vertical stack on phone
15. **responsive-modals** — Modal sizing for small screens
16. **responsive-response-viewer** — `overflow-x: auto` on code/XML blocks
17. **test-android-build** — Full Android build and smoke-test on emulator/device
18. **test-ios-build** — Full iOS build and smoke-test on simulator
19. **feature-file-picker** — Verify file picker dialog on Android and iOS
20. **feature-certs-android** — Implement Android certificate trust store
21. **polish-ios-safe-areas** — iOS safe area insets

---

## Notes

- **`tauri-plugin-decorum`** is the most likely crash point on first mobile build — fix before anything else.
- Android **cleartext HTTP** blocking is the second most likely issue since APInox targets SOAP services.
- The **split-screen vs drawer** breakpoint is at **900px** width (CSS `@media`).
- `tauri android init` / `tauri ios init` generate files in `src-tauri/gen/` — this directory should be committed after init.
- The `src-tauri/gen/android/` project can be opened directly in Android Studio for debugging, layout inspection, and device management.
- The `src-tauri/gen/apple/` project can be opened in Xcode for iOS simulator/device testing.
