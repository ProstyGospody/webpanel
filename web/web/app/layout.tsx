import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { AppThemeProvider } from "@/components/providers/app-theme-provider";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-panel",
});

export const metadata: Metadata = {
  title: "Hysteria 2 Panel",
  description: "Operations panel for Hysteria 2 service and access lifecycle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
