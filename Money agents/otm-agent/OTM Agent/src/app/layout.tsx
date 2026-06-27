import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OTM Agent – Out The Mud",
  description:
    "Automated bootstrapping system — from zero to funded. Deploy sub-agents to scan the internet for real, executable money opportunities.",
  keywords: [
    "OTM Agent",
    "bootstrapping",
    "automation",
    "AI agents",
    "income generation",
    "entrepreneurship",
  ],
  authors: [{ name: "OTM Agent Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "OTM Agent – Out The Mud",
    description: "Automated bootstrapping system — from zero to funded",
    url: "https://otm.agent",
    siteName: "OTM Agent",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OTM Agent – Out The Mud",
    description: "Automated bootstrapping system — from zero to funded",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
