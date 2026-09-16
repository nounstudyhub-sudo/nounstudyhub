import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-inner">
          <Link href="/" className="legal-brand"><span className="brand-mark">N</span><span className="legal-brand-name">NounStudyHub</span></Link>
          <Link href="/" className="legal-back">← Back to home</Link>
        </div>
      </header>
      <main className="legal-inner legal-main">
        <div className="legal-kicker">LEGAL</div>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <div className="legal-body">{children}</div>
      </main>
      <footer className="legal-footer">
        <div className="legal-inner">© 2026 NounStudyHub · nounstudyhub@gmail.com</div>
      </footer>
    </div>
  );
}
