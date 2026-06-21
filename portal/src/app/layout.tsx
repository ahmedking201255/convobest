import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConvoBest - WhatsApp API Platform",
  description: "منصة احترافية لخدمات WhatsApp API، حملات الإرسال الجماعي، بوتات الذكاء الاصطناعي، وتكاملات التجارة الإلكترونية.",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className="h-full"
    >
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body className="min-h-full w-full max-w-[100vw] overflow-x-hidden">{children}</body>
    </html>
  );
}
