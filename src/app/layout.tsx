import type { Metadata, Viewport } from "next";
// Fonts are self-hosted from npm (@fontsource), so builds never fetch from Google Fonts.
// next/font/google crashed on Vercel when Google returned a font URL without a file extension.
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-600.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/roboto-condensed/latin-700.css";
import "@fontsource/roboto-condensed/latin-800.css";
import "@/styles/tokens.css";
import "@/styles/app.css";
import { AuthProvider } from "@/components/client/AuthProvider";
import { THEME_BOOT } from "@/components/client/ThemeToggle";
import { currentUser } from "@/lib/server/session";
import { getProvider } from "@/lib/data/provider";


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
    <html lang="en" suppressHydrationWarning>
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
