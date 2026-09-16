import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — NounStudyHub",
  description: "How NounStudyHub collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 2026">
      <p>
        NounStudyHub (&ldquo;we&rdquo;, &ldquo;our&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains what information we collect when you use our platform, how we use it, and the choices you have. By using NounStudyHub, you agree to the practices described here.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — the username and matriculation number you provide when you create an account, plus your password (stored securely as a one-way hash, never in plain text).</li>
        <li><strong>Optional contact information</strong> — a phone number, if you choose to add one to your profile. Providing a phone number is always optional.</li>
        <li><strong>Study activity</strong> — the courses you view and favourite, the mocks you attempt, your answers, scores, and progress. This data is used to personalise your experience and power features like history, leaderboards and progress tracking.</li>
        <li><strong>Requests and messages</strong> — course requests you submit and notifications we generate for your account.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and secure your account, and to let you log in.</li>
        <li>To deliver course summaries, question banks and mock exams.</li>
        <li>To calculate and display your own results, mock history and progress.</li>
        <li>To place you in a suitable comparison group for the student leaderboard based only on the courses you have actually attempted.</li>
        <li>To respond to course requests and support enquiries.</li>
        <li>To improve the platform and fix problems.</li>
      </ul>

      <h2>3. Legal basis for processing</h2>
      <p>
        We process your information where it is necessary to provide the service you requested, to comply with our legal obligations, and to pursue our legitimate interests in operating and improving NounStudyHub. Where we rely on consent, you may withdraw it at any time.
      </p>

      <h2>4. How we share information</h2>
      <p>
        We do <strong>not</strong> sell, rent or trade your personal information. Your password hash is never shared. We may share information only in the limited circumstances described below:
      </p>
      <ul>
        <li><strong>On the leaderboard</strong> — only your username appears alongside other students. Your scores, matriculation number and phone number are never shown publicly.</li>
        <li><strong>Service providers</strong> — trusted providers who help us host and operate the platform, subject to confidentiality obligations.</li>
        <li><strong>Legal requirements</strong> — where disclosure is required by law or to protect the safety and rights of others.</li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We keep your account information and study activity for as long as your account remains active and for a reasonable period afterwards, or as required by law. If you would like your account and data removed, you can contact us at <a href="mailto:nounstudyhub@gmail.com">nounstudyhub@gmail.com</a>.
      </p>

      <h2>6. Data security</h2>
      <p>
        We use appropriate technical and organisational safeguards, including secure password hashing, protected routes and secure session handling, to keep your information safe. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>7. Your rights</h2>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Correct inaccurate or incomplete information.</li>
        <li>Request deletion of your account and data.</li>
        <li>Object to or restrict certain processing.</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:nounstudyhub@gmail.com">nounstudyhub@gmail.com</a>.</p>

      <h2>8. Cookies and local storage</h2>
      <p>
        NounStudyHub uses a secure, httpOnly session cookie to keep you signed in. We do not use third-party advertising cookies.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        Our Contact page may link to external services such as WhatsApp. We are not responsible for the privacy practices of third-party websites and encourage you to review their policies.
      </p>

      <h2>10. Children&apos;s privacy</h2>
      <p>
        NounStudyHub is intended for students in tertiary education. We do not knowingly collect information from children under 13. If you believe a child has provided us with personal information, please contact us and we will take steps to delete it.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The date at the top of this page shows when it was last revised. We encourage you to review it periodically.
      </p>

      <h2>12. Contact us</h2>
      <p>
        If you have any questions about this Privacy Policy, email us at <a href="mailto:nounstudyhub@gmail.com">nounstudyhub@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
