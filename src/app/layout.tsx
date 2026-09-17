import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "House Sixty CRM",
  description: "House Sixty üye ilişkileri yönetim paneli",
  // Belt and braces with the X-Robots-Tag header in next.config.mjs. An internal panel
  // has no business in a search index, and the two mechanisms fail differently.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The panel is a desktop tool; the sidebar layout assumes it. This keeps a phone
  // from rendering it at a fake 980px width, which is worse than an honest scroll.
  themeColor: "#262320",
};

/**
 * `lang="tr"` is not decoration. The UI is Turkish throughout (code and comments are
 * English, per the project's convention), and the attribute is what tells a screen
 * reader which voice to use and the browser which hyphenation and spellcheck rules
 * apply. An English `lang` over Turkish copy makes assistive tech read it as gibberish.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/*
         * Written by hand, and `crossOrigin` is the entire reason.
         *
         * A browser fetches a manifest with credentials OMITTED unless told otherwise —
         * even same-origin. The panel sits behind Amplify's basic auth, so that request
         * came back 401, Chrome concluded there was no manifest, and **Install simply
         * never appeared**, with no error in the console and nothing in the network tab
         * that looks like a failure. MDN is explicit: "If the manifest requires
         * credentials to fetch, the crossorigin attribute must be set to
         * use-credentials, even if the manifest file is in the same origin as the
         * current page."
         *
         * This is the third costume of the same bug. The first was middleware bouncing
         * the manifest to /login (fixed by excluding it from the matcher); this is the
         * gate in front of the app doing the same thing one layer up. Anything the
         * browser fetches anonymously needs checking against both.
         *
         * ⚠️ It is a hand-written tag because `app/manifest.ts` had to go: Next's
         * Metadata API emits `<link rel="manifest">` with no way to set `crossOrigin`,
         * and two manifest links would leave which one wins to document order. The
         * manifest is therefore a static file at `public/manifest.webmanifest`. Do not
         * reintroduce `app/manifest.ts` — it would inject a second, credential-less link
         * and put the bug straight back.
         */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>{children}</body>
    </html>
  );
}
