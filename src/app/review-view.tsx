'use client';

import { useEffect, useState } from "react";

type ReviewProps = { course: { code: string; title: string }; attemptId: string; questions: { id: string; question: string }[]; onBack: () => void };
type ReviewRow = { question: string; selected: string | null; correct: string; explanation: string };

export default function ReviewView({ course, attemptId, questions, onBack }: ReviewProps) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  useEffect(() => {
    if (attemptId === "demo") { setRows(questions.map((item) => ({ question: item.question, selected: "B", correct: "B", explanation: "The correct option is the most complete and accurate definition of the concept in question." }))); return; }
    fetch(`/api/mock/${attemptId}`).then((response) => response.json()).then((data) => setRows((data.answers || []).map((item: { answer: { selectedAnswer: string | null; correctAnswer: string }; question: { question: string; explanation?: string | null } }) => ({ question: item.question.question, selected: item.answer.selectedAnswer, correct: item.answer.correctAnswer, explanation: item.question.explanation || "" })))).catch(() => undefined);
  }, [attemptId, questions]);
  const displayRows = rows.length ? rows : [{ question: "Your submitted answers will appear here after the mock is saved.", selected: null, correct: "—", explanation: "" }];
  return <div className="review-page"><button className="back-link" onClick={onBack}><span className="icon">→</span> Back to result</button><div className="page-heading"><div><div className="eyebrow">ANSWER REVIEW · {course.code}</div><h1>Review your mock</h1><p>See why each correct answer is right, and where to focus next.</p></div></div><div className="review-list">{displayRows.map((row, index) => <article className={`review-card ${row.selected && row.selected === row.correct ? "is-correct" : "is-wrong"}`} key={`${row.question}-${index}`}><div className="review-card-top"><span>QUESTION {String(index + 1).padStart(2, "0")}</span><strong>{row.selected && row.selected === row.correct ? "Correct" : "Review this"}</strong></div><h2>{row.question}</h2><div className="review-answers"><div><small>Your answer</small><strong className={row.selected === row.correct ? "answer-good" : "answer-bad"}>{row.selected ?? "Unanswered"}</strong></div><div><small>Correct answer</small><strong className="answer-good">{row.correct}</strong></div></div>{row.explanation ? <div className="review-explanation"><span className="icon">✎</span><div><small>Why this is correct</small><p>{row.explanation}</p></div></div> : null}</article>)}</div></div>;
}
