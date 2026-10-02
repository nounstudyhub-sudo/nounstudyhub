"use client";

import { MockQuestionReview } from "./ai-components";

type ReviewProps = { course: { code: string; title: string }; attemptId: string; onBack: () => void };

export default function ReviewView({ course, attemptId, onBack }: ReviewProps) {
  return <div className="review-page">
    <button className="back-link" onClick={onBack}><span className="icon">→</span> Back to result</button>
    <div className="page-heading"><div><div className="eyebrow">ANSWER REVIEW · {course.code}</div><h1>Review your mock</h1><p>See why each correct answer is right, and where to focus next.</p></div></div>
    <MockQuestionReview key={attemptId} attemptId={attemptId}/>
  </div>;
}
