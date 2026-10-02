import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./admin/admin.css";

export const metadata: Metadata = {
  title: "NounStudyHub — Study smarter, together",
  description: "Course summaries, mock CBT practice and progress tracking for NOUN students.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
