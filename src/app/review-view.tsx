"use client";

import { useEffect, useState } from "react";

type ReviewProps = {
  course: { code: string; title: string };
  attemptId: string;
  onBack: () => void;
  onRetake?: () => void;
};

type ReviewRow = {
  question: string;
  questionType: "MCQ" | "FBQ";
  selected: string | null;
  selectedText: string | null;
  correct: string;
  correctText: string;
  explanation: string;
};

type ReviewResponse = {
  answers: {
    answer: {
      selectedAnswer: string | null;
      correctAnswer: string;
      questionType: "MCQ" | "FBQ";
    };
    question: {
      question: string;
      questionType: "MCQ" | "FBQ";
      optionA?: string | null;
      optionB?: string | null;
      optionC?: string | null;
      optionD?: string | null;
      explanation?: string | null;
    };
  }[];
};

const optionNames = ["A", "B", "C", "D"] as const;

export default function ReviewView({ course, attemptId, onBack, onRetake }: ReviewProps) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/mock/${encodeURIComponent(attemptId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as ReviewResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load mock answers.");
        return data;
      })
      .then((data) => {
        setRows(data.answers.map(({ answer, question }) => {
          const questionType = answer.questionType ?? question.questionType;
          const options: Record<string, string | null | undefined> = {
            A: question.optionA,
            B: question.optionB,
            C: question.optionC,
            D: question.optionD,
          };
          const selected = answer.selectedAnswer;
          const correct = answer.correctAnswer;
          const isFillInBlank = questionType === "FBQ";

          return {
            question: question.question,
            questionType,
            selected,
            selectedText: selected ? (isFillInBlank ? selected : options[selected] ?? null) : null,
            correct,
            correctText: isFillInBlank ? correct : options[correct] ?? "",
            explanation: question.explanation ?? "",
          };
        }));
      })
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attemptId]);

  return <div className="review-page">
    <button className="back-link" onClick={onBack}><span className="icon">→</span> Back to result</button>
    <div className="page-heading">
      <div>
        <div className="eyebrow">ANSWER REVIEW · {course.code}</div>
        <h1>Review your mock</h1>
        <p>See why each correct answer is right, and where to focus next.</p>
      </div>
      {onRetake && <button className="button button-primary" onClick={onRetake}><span className="icon">↻</span> Retake mock</button>}
    </div>

    {loading && <div className="loading-state" role="status"><span className="loader"/> Loading your answers…</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && !error && rows.length === 0 && <div className="empty-state"><h3>No answers to review</h3><p>This mock does not have any saved answers.</p></div>}
    {!loading && rows.length > 0 && <div className="review-list">
      {rows.map((row, index) => {
        const isCorrect = row.selected !== null && row.selected.trim().toLowerCase() === row.correct.trim().toLowerCase();
        return <article className={`review-card ${isCorrect ? "is-correct" : "is-wrong"}`} key={`${row.question}-${index}`}>
          <div className="review-card-top">
            <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
            <strong>{isCorrect ? "Correct" : "Review this"}</strong>
          </div>
          <h2>{row.question}</h2>
          <div className="review-answers">
            <div>
              <small>Your answer</small>
              <strong className={isCorrect ? "answer-good" : "answer-bad"}>
                {row.selected ? row.questionType === "FBQ" ? row.selectedText : <>{row.selected} <span>·</span> {row.selectedText}</> : "Unanswered"}
              </strong>
            </div>
            <div>
              <small>Correct answer</small>
              <strong className="answer-good">
                {row.questionType === "FBQ" ? row.correctText : <>{row.correct} <span>·</span> {row.correctText}</>}
              </strong>
            </div>
          </div>
          {row.explanation && <div className="review-explanation">
            <span className="icon">✎</span>
            <div><small>Why this is correct</small><p>{row.explanation}</p></div>
          </div>}
        </article>;
      })}
    </div>}
  </div>;
}
