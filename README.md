# Preact PWA

A single-page Preact landing page built with Preact CLI that is installable as a Progressive Web App on Chrome, Samsung Internet, Firefox (Android) and iOS Safari.

## Stack

- [Preact](https://preactjs.com/) (3 KB React-compatible UI library)
- [Preact CLI](https://github.com/preactjs/preact-cli) (Webpack + Workbox under the hood)
- Vanilla JavaScript, HTML, CSS
- Workbox-powered service worker for offline support

## CLI Commands

```bash
# install dependencies (one-time)
npm install

# dev server with hot reload at http://localhost:8080
# Note: service worker is disabled in dev so install prompts won't fire here
npm run dev

# production build (output: ./build)
npm run build

# preview the production build at http://localhost:8080
# Use this to test PWA install on desktop and over LAN
npm run serve

# run tests
npm run test

# regenerate placeholder icons (rarely needed)
node scripts/generate-icons.js
```

## Testing PWA install per browser

PWAs require **HTTPS or localhost** to be installable. Use `npm run serve` and open via `http://localhost:8080` to test locally. To test on a real phone over LAN, run `npx sirv build --port 8080 --cors --single --host` and open the LAN URL in the phone's browser (some browsers also require HTTPS for non-localhost; use a tunnel like `ngrok http 8080` for a quick HTTPS URL).

| Browser | How to install |
|---|---|
| Chrome (desktop) | Click the install icon at the right edge of the address bar, or use the in-page "Install App" button. |
| Chrome (Android) | Tap menu (`⋮`) -> "Install app", or tap the in-page "Install App" button. |
| Edge (desktop) | Same as Chrome - install icon in the address bar. |
| Samsung Internet | Tap menu -> "Add page to" -> "Home screen", or tap the in-page button (Chromium-based, supports `beforeinstallprompt`). |
| Firefox (Android) | Tap menu (`⋮`) -> "Install". |
| Firefox (desktop) | **Not supported** - Firefox desktop does not install PWAs. This is a browser limitation. |
| iOS Safari (16+) | Tap **Share** -> **Add to Home Screen** -> **Add**. The in-app button shows these steps when an iOS device is detected. `beforeinstallprompt` is not implemented on iOS. |

## Project layout

```
src/
  index.js                  # Preact entry
  template.html             # HTML template (manifest link + iOS meta tags)
  manifest.json             # Web App Manifest
  sw.js                     # Service worker (Workbox precaching)
  components/
    app.js                  # Root: renders <Home />
  routes/
    home/                   # Single landing page (hero, features, CTA, footer)
      index.js
      style.css
  hooks/
    useInstallPrompt.js     # beforeinstallprompt handling + iOS detection
  style/
    index.css               # Global styles, CSS vars, dark mode
  assets/
    icons/                  # 192/512/maskable + apple-touch-icon
scripts/
  generate-icons.js         # Regenerates placeholder PWA icons (no deps)
```

## Replacing the placeholder icons

The icons in `src/assets/icons/` are auto-generated placeholders (gradient + "P"). To use your own:

1. Replace any of: `icon-192.png` (192x192), `icon-512.png` (512x512), `icon-maskable-512.png` (512x512 with the logo inside the central 80% safe zone), `apple-touch-icon-180.png` (180x180, opaque - iOS adds the rounded corners).
2. Re-run `npm run build`.

Apple-touch-icon must be opaque (no transparency) and must not have rounded corners pre-applied.

## Notes

- Preact CLI is in maintenance mode (last release 3.5.1, Jan 2024) but remains stable. The Preact team now recommends Vite for new projects via `create-preact`.
- The build runs Node with `NODE_OPTIONS=--openssl-legacy-provider` (already wired in `package.json`) so it works on Node 17+.

## How the install button behaves per browser

The manifest uses `"display": "standalone"` so the app installs as a real PWA (own launcher icon, no browser chrome). The in-page install button has three code paths in [src/hooks/useInstallPrompt.js](src/hooks/useInstallPrompt.js):

| Browser | Behavior of the in-page install button |
|---|---|
| Chrome / Edge / Brave (Android & desktop) | Calls the captured `beforeinstallprompt` event so the user gets the **native one-tap install dialog**. |
| Firefox (Android) | Same as Chrome - native install prompt. |
| **Samsung Internet** | Opens an in-page modal showing **"menu (≡) -> Add page to -> Home screen"**. We deliberately bypass the native WebAPK install on this browser (see next section). |
| iOS Safari | Opens an in-page modal showing **Share -> Add to Home Screen**. iOS doesn't expose `beforeinstallprompt`. |

After install, the button hides itself via the `appinstalled` event and (where supported) the `display-mode: standalone` media query.

## Why Samsung Internet is special-cased

On Android 14+, when Samsung Internet (or Chrome) installs a PWA via the native install prompt, Android packages it as a **WebAPK** minted by Google's WebAPK Minting Server. Those WebAPKs target an older Android API level, which trips Google Play Protect:

> "Unsafe app blocked - PreactPWA - This app was built for an older version of Android and doesn't include the latest privacy protections."

This is a Google-side rollout issue, not a bug in this PWA. To avoid showing that dialog to Samsung users, the install hook detects the `SamsungBrowser` token in the user-agent and steers users to the **menu shortcut** path instead. Samsung Internet's "Add page to -> Home screen" creates a plain shortcut (no WebAPK), so Play Protect never runs. The shortcut still launches the app in standalone mode because the manifest is honored when the user opens it.

Other Chromium browsers (Chrome, Edge) keep the native one-tap install because they're far less likely to hit the Play Protect dialog (different Play Services/WebAPK targetSdkVersion path on non-Samsung phones). If you ever want the native one-tap install on Samsung too, delete the `detectSamsungInternet` branch in [src/hooks/useInstallPrompt.js](src/hooks/useInstallPrompt.js).
