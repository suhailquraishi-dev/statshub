import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/app.css";
import { AuthProvider } from "@/components/client/AuthProvider";
import { THEME_BOOT } from "@/components/client/ThemeToggle";
import { currentUser } from "@/lib/server/session";
import { getProvider } from "@/lib/data/provider";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-roboto", display: "swap" });
const condensed = Roboto_Condensed({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-roboto-condensed", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "ES FanPulse: NFL stats and fan debate", template: "%s · ES FanPulse" },
  description: "Compare verified NFL matchup stats, vote on data-backed questions and back up your take with evidence.",
  // While the site runs on demo data, nothing is indexed.
  robots: getProvider().isDemo ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#101114" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  return (
    <html lang="en" className={`${roboto.variable} ${condensed.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <AuthProvider initialUser={u ? { id: u.id, displayName: u.displayName, role: u.role } : null}>{children}</AuthProvider>
      </body>
    </html>
  );
}
