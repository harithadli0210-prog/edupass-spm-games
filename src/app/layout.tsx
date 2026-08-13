import type { Metadata, Viewport } from "next";
import { Poppins, Nunito_Sans } from "next/font/google";
import "./globals.css";

/**
 * Self-hosted via next/font rather than the Google Fonts CDN the marketing site
 * uses. Gameplay must not block on a third-party request over a weak mobile
 * connection, and a silent fallback mid-round would reflow the question card.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SPM Games 2026 — EduPass",
    template: "%s — SPM Games 2026",
  },
  description:
    "A nationwide SPM challenge for every Malaysian student. Play daily, climb the leaderboard, and discover where your strengths point.",
};

export const viewport: Viewport = {
  // The logo purple. Tints the browser chrome on Android and the status bar in
  // a saved-to-homescreen install.
  themeColor: "#6846d6",
  width: "device-width",
  initialScale: 1,
  // Students zoom to read questions on small screens; never lock that away.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-MY">
      <body className={`${poppins.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
