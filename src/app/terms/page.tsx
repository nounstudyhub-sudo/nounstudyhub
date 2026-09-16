import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = {
  title: "Terms of Use — NounStudyHub",
  description: "The terms that govern your use of NounStudyHub.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="September 2026">
      <p>
        Welcome to NounStudyHub. These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of our study and mock examination platform. By creating an account or using NounStudyHub, you agree to these Terms. If you do not agree, please do not use the platform.
      </p>

      <h2>1. About the service</h2>
      <p>
        NounStudyHub is a study and mock CBT platform built for NOUN students. It provides course summaries, course modules, past-question-based question banks, mock exams, mock history, performance tracking and leaderboards. The platform is course-based and is open to any student whose desired course has been made available by the administrator.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must provide a unique username, a secure password and your matriculation number to create an account.</li>
        <li>You are responsible for keeping your login credentials confidential and for all activity that occurs under your account.</li>
        <li>You agree to provide accurate information and to keep your profile details up to date.</li>
        <li>We may suspend or terminate accounts that violate these Terms or are used inappropriately.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the platform for any unlawful purpose.</li>
        <li>Attempt to gain unauthorised access to other accounts, systems or the administrator area.</li>
        <li>Copy, scrape, redistribute or republish course content or question banks outside the platform without permission.</li>
        <li>Reverse engineer, decompile or interfere with the platform&apos;s operation.</li>
        <li>Submit false, misleading, defamatory or abusive content.</li>
      </ul>

      <h2>4. Course content and question banks</h2>
      <p>
        Course summaries, modules and question banks are provided for personal study purposes. They are added and managed by the platform administrator. While we aim for accuracy, we do not guarantee that any content is complete, current or free of errors.
      </p>

      <h2>5. Mock examinations — important disclaimer</h2>
      <p>
        Mock exams are practice tools only. Completing a mock does <strong>not</strong> guarantee any particular result in any real examination, and questions shown in mocks may not appear in any actual exam. NounStudyHub is an independent study aid and is not affiliated with, or endorsed by, the National Open University of Nigeria.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        The NounStudyHub name, branding, design and platform software are our property (or used under licence). Course summaries, modules and question banks supplied by us are protected and may not be copied or distributed without our permission.
      </p>

      <h2>7. Your content</h2>
      <p>
        By submitting content such as course requests, you grant us a licence to use it to operate the platform. You are responsible for ensuring that anything you submit is lawful and does not infringe the rights of others.
      </p>

      <h2>8. Leaderboards and eligibility</h2>
      <p>
        Leaderboard rankings are based on actual performance data and require a reasonable history of completed mocks. To keep comparisons fair, a student with insufficient attempt history may not appear on the leaderboard. Public leaderboards show only usernames — never scores or personal details.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access at any time if you breach these Terms, for security reasons, or if we discontinue the service. You may stop using the platform at any time.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including fitness for a particular purpose and non-infringement.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, NounStudyHub and its operators will not be liable for any indirect, incidental, special or consequential damages, or for any loss of data or examination outcomes, arising out of or related to your use of the platform.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated Terms.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes will be subject to the exclusive jurisdiction of the Nigerian courts.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email us at <a href="mailto:nounstudyhub@gmail.com">nounstudyhub@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
