import type { Metadata } from "next";

import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "Admin panel for Hysteria 2 and MTProxy",
  icons: {
    icon: "/proxy-panel-logo.svg",
    shortcut: "/proxy-panel-logo.svg",
    apple: "/proxy-panel-logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <ThemeProvider>
          <TooltipProvider delay={100}>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


