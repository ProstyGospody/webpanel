import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { AppThemeProvider } from "@/theme/app-theme-provider";

import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-panel-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-panel-mono" });

export const metadata: Metadata = {
  title: "Hysteria 2 Panel",
  description: "Operations panel for Hysteria 2 service and access lifecycle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}

