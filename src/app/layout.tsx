import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DebugPayloadDialog } from "@/components/debug/debug-payload-dialog";

export const metadata: Metadata = {
  title: {
    default: "VibeDraft",
    template: "%s — VibeDraft",
  },
  description: "VibeDraft — a private desk for planning and drafting long-form fiction.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <Providers>
          {children}
          <DebugPayloadDialog />
        </Providers>
      </body>
    </html>
  );
}
