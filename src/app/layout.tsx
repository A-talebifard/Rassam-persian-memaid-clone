import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";

export const metadata: Metadata = {
  title: "رسام - ویرایشگر نمودارهای علمی",
  description: "ابزار ساخت و تولید نمودارهای علمی با رسام — Powered by Mermaid",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
        style={{ fontFamily: "'Vazirmatn', sans-serif" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
