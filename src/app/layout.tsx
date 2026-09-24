import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { MotionConfig } from "motion/react";
import { themeScript } from "@/lib/theme-script";
import { bootScript } from "@/lib/boot-script";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Backlog",
    template: "%s · Backlog",
  },
  description:
    "Your games, movies, series and anime — what's next, what's in progress, what's done.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  // Added to an iPhone home screen, open full-screen like a native app,
  // drawing under a translucent status bar (the layout pads for it).
  appleWebApp: {
    capable: true,
    title: "Backlog",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  // Lets the page extend under the notch / home indicator; safe-area insets
  // pad the top bar, tab bar and sheets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${serif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
