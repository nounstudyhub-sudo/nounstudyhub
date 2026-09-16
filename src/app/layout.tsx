import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import "./admin/admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "WONK", "opsz"] });

export const metadata: Metadata = {
  title: "NounStudyHub — Study smarter, together",
  description: "Course summaries, mock CBT practice and progress tracking for NOUN students.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${fraunces.variable}`}><body>{children}</body></html>;
}
