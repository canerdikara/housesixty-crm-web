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
      <body>{children}</body>
    </html>
  );
}
