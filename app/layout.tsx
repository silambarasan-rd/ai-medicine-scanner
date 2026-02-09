import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";
import Navbar from "./components/Navbar";
import ToastProvider from "./components/ToastProvider";
import TooltipProvider from "./components/TooltipProvider";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: "MathirAI",
  description: "An AI-powered PWA that identifies medicines via camera using Google Gemini Vision. Features include auto-capture and safety warnings (driving/alcohol).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3e4c5e" />
        <link rel="apple-touch-icon" href="/medicine-logo.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

        <meta name="application-name" content="MathirAI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MathirAI - AI Medicine Scanner" />
        <meta name="description" content="An AI-powered PWA that identifies medicines via camera using Google Gemini Vision. Features include auto-capture and safety warnings (driving/alcohol)." />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        <meta name="twitter:card" content="An AI-powered PWA that identifies medicines via camera using Google Gemini Vision. Features include auto-capture and safety warnings (driving/alcohol)." />
        <meta name="twitter:url" content="https://mathirai.netlify.app/" />
        <meta name="twitter:title" content="MathirAI - AI Medicine Scanner" />
        <meta name="twitter:description" content="An AI-powered PWA that identifies medicines via camera using Google Gemini Vision. Features include auto-capture and safety warnings (driving/alcohol)." />
        <meta name="twitter:image" content="https://mathirai.netlify.app/medicine-logo.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MathirAI - AI Medicine Scanner" />
        <meta property="og:description" content="An AI-powered PWA that identifies medicines via camera using Google Gemini Vision. Features include auto-capture and safety warnings (driving/alcohol)." />
        <meta property="og:site_name" content="MathirAI - AI Medicine Scanner" />
        <meta property="og:url" content="https://mathirai.netlify.app/" />
      </head>
      <body className="antialiased">
        <Navbar />
        {children}
        <ToastProvider />
        <TooltipProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
