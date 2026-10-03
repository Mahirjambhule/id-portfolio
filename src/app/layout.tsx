import type { Metadata, Viewport } from "next";
import { DM_Mono, Newsreader, The_Nautigal } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { site } from "@/lib/site";
import "./globals.css";

// Three voices. The serif sets the headlines and the running copy: its
// optical-size axis draws a finer, higher-contrast cut large and a sturdier
// one small, so one family does both jobs.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// Labels, navigation and the badge's small print.
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// The signature in the hero. It only ever sets a few words.
const nautigal = The_Nautigal({
  variable: "--font-nautigal",
  subsets: ["latin"],
  weight: "400",
});

const title = `${site.name} — ${site.role}`;

// Where a link to the site is shared, it shows its own picture
// (app/opengraph-image.tsx). Those addresses are made from `site.url`.
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title,
  description: site.description,
  openGraph: { type: "website", siteName: site.name, title, description: site.description },
  twitter: { card: "summary_large_image", title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: "#f4f1eb",
};

// Copy is revealed by script once the badge has settled. Without script it
// should simply be there.
const NOSCRIPT_CSS =
  "[data-reveal]{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${dmMono.variable} ${nautigal.variable}`}>
      <body>
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} />
        </noscript>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
