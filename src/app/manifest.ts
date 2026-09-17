import type { MetadataRoute } from "next";

/**
 * What turns the panel into a desktop app.
 *
 * The customer asked for an `.exe`; what they wanted was an icon that opens the CRM in
 * its own window instead of as one tab among twenty (2026-09-16). This is that — with
 * the manifest in place, Chrome and Edge offer **Install** and the panel gets a desktop
 * shortcut, a taskbar entry and a window with no address bar.
 *
 * The alternative, wrapping the Next server in Electron, was priced and rejected: the
 * panel is server-rendered with server actions and middleware, so it needs a Node
 * process either way, and an installer means ~220MB per machine, a code-signing
 * certificate, and redistributing every fix. This updates the moment the site deploys.
 *
 * ⚠️ **No service worker, and deliberately none.** A service worker is the usual
 * companion to a manifest, and the usual reason for one is offline caching — which here
 * would write members' names, phone numbers and identity details into a cache on
 * whatever machine the panel was opened on. The API client already sends `no-store` for
 * the same reason. If an install prompt ever needs one, it must be a no-op worker that
 * caches nothing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "House Sixty CRM",
    // What fits under an icon. Chrome truncates around 12 characters.
    short_name: "HS CRM",
    description: "House Sixty müşteri ilişkileri yönetimi",
    lang: "tr",
    dir: "ltr",

    /*
     * The panel root, not /login. Middleware sends an unauthenticated visitor to the
     * login screen and a signed-in one straight to the dashboard, so starting here is
     * right in both cases — and pinning /login would strand anyone already signed in on
     * a redirect every time they opened the app.
     */
    start_url: "/",
    scope: "/",
    display: "standalone",
    // No `orientation`. This is a desktop panel of wide tables; locking it to portrait
    // would be wrong on a tablet and is ignored everywhere else.

    // The window chrome and the splash, taken from the panel's own tokens: the sidebar
    // charcoal and the page ground it sits on.
    theme_color: "#262320",
    background_color: "#e8e3da",

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /*
       * Maskable as well: Android and some Windows surfaces crop an icon to their own
       * shape, and an icon that does not declare itself maskable gets shrunk into a
       * white rounded square instead. Safe here because the wordmark occupies the middle
       * ~45%, well inside the 80% safe zone a maskable crop guarantees.
       */
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
