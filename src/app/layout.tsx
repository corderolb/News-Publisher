import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";
import AppNav from "./AppNav";
import TopBar from "./TopBar";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spielfilm.de AI-Research Tool",
  description: "Automatisiertes News-Rewriting mit RSS und Webseiten-Quellen",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${ibmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppNav />
        <TopBar />
        <main className="min-h-screen pt-[57px] lg:pl-72 lg:pt-16">{children}</main>
      </body>
    </html>
  );
}
