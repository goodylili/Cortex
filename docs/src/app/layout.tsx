import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.scss";
import { SideNav } from "./SideNav";
import { MobileNav } from "./MobileNav";
import { MobileNotice } from "./MobileNotice";

export const metadata: Metadata = {
  metadataBase: new URL("https://cortex.com"),
  title: "Cortex",
  description: "Local-first memory infrastructure for agents.",
  openGraph: {
    title: "Cortex",
    description: "Local-first memory infrastructure for agents.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cortex",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cortex",
    description: "Local-first memory infrastructure for agents.",
    images: ["/og-image.png"],
  },
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=expose@400,500,700&display=swap" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <MobileNotice />
        <MobileNav />
        <SideNav />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
