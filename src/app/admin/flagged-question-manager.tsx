'use client';

import { useCallback, useEffect, useState } from "react";
import "./flagged-question-manager.css";

type FlaggedQuestionItem = {
  id: string;
  status: "pending" | "dismissed" | "deleted";
  reason: string;
  createdAt: string;
  questionId: {
    id: string;
    question: string;
    questionType: "MCQ" | "FBQ" | "TF";
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    correctAnswer: string;
  } | null;
  course: { id: string; code: string; title: string } | null;
  user: { id: string; username: string; matriculationNumber: string } | null;
};

type FlaggedQuestionCounts = { pendingCount: number; dismissedCount: number; deletedCount: number };

async function adminFlagRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not complete the request.");
  return data;
}

export default function FlaggedQuestionManager({ onCountsChange }: { onCountsChange: (counts: FlaggedQuestionCounts) => void }) {
  const [items, setItems] = useState<FlaggedQuestionItem[]>([]);
  const [selected, setSelected] = useState<FlaggedQuestionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const data = await adminFlagRequest("/api/admin/flagged-questions", { method: "POST" });
    const flaggedQuestions = Array.isArray(data.flaggedQuestions) ? data.flaggedQuestions as FlaggedQuestionItem[] : [];
    setItems(flaggedQuestions);
    const counts = {
      pendingCount: Number(data.pendingCount) || 0,
      dismissedCount: Number(data.dismissedCount) || 0,
      deletedCount: Number(data.deletedCount) || 0,
    };
    onCountsChange(counts);
  }, [onCountsChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh().catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Could not load flagged questions."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function resolve(item: FlaggedQuestionItem, status: "dismissed" | "deleted") {
    if (pendingId) return;
    setPendingId(item.id);
    setError("");
    try {
      await adminFlagRequest(`/api/admin/flagged-questions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not resolve this flag.");
    } finally {
      setPendingId(null);
    }
  }

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const dismissedCount = items.filter((item) => item.status === "dismissed").length;
  const deletedCount = items.filter((item) => item.status === "deleted").length;
  const question = selected?.questionId;

  return <>
    <div className="admin-section-intro">
      <div><h2>Flagged questions</h2><p>Review student reports and resolve issues in the question bank.</p></div>
    </div>
    <div className="admin-stat-grid flagged-summary">
      <div className="admin-stat"><span className="admin-stat-icon orange">⚑</span><small>Pending flags</small><strong>{pendingCount}</strong><p>Questions awaiting review</p></div>
      <div className="admin-stat"><span className="admin-stat-icon blue">✓</span><small>Dismissed</small><strong>{dismissedCount}</strong><p>Questions reviewed &amp; kept</p></div>
      <div className="admin-stat"><span className="admin-stat-icon red">×</span><small>Deleted</small><strong>{deletedCount}</strong><p>Questions removed from bank</p></div>
    </div>
    {error && <div className="admin-import-errors flagged-error" role="alert">{error}</div>}
    {loading ? <div className="admin-panel admin-empty">Loading flagged questions…</div> : items.length ? <div className="flagged-question-grid">
      {items.map((item) => <article className="admin-panel flagged-question-card" key={item.id} onClick={() => setSelected(item)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(item); } }}>
        <div className="flagged-card-heading"><span className={`flagged-status ${item.status}`}>{item.status}</span><small>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</small></div>
        <h3>{item.questionId?.question ?? "Question no longer exists"}</h3>
        <div className="flagged-card-meta">
          <span><strong>{item.course?.code ?? "Unknown course"}</strong>{item.course?.title ? ` · ${item.course.title}` : ""}</span>
          <span>Reported by {item.user?.username ?? "Unknown student"}</span>
        </div>
        {item.status === "pending" && <div className="flagged-card-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="flagged-dismiss-button" disabled={pendingId !== null} onClick={() => void resolve(item, "dismissed")}>{pendingId === item.id ? "Saving…" : "Dismiss"}</button>
          <button type="button" className="flagged-delete-button" disabled={pendingId !== null} onClick={() => void resolve(item, "deleted")}>{pendingId === item.id ? "Saving…" : "Delete"}</button>
        </div>}
      </article>)}
    </div> : <div className="admin-panel admin-empty">No flagged questions have been submitted.</div>}

    {selected && <div className="flagged-modal-backdrop" onMouseDown={(event) => { if (!pendingId && event.target === event.currentTarget) setSelected(null); }}>
      <section className="flagged-modal" role="dialog" aria-modal="true" aria-labelledby="flagged-detail-title">
        <button type="button" className="flagged-modal-close" aria-label="Close question details" disabled={pendingId !== null} onClick={() => setSelected(null)}>×</button>
        <div className="flagged-card-heading"><span className={`flagged-status ${selected.status}`}>{selected.status}</span><small>{new Date(selected.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</small></div>
        <h2 id="flagged-detail-title">{question?.question ?? "Question no longer exists"}</h2>
        <p className="flagged-modal-meta">{selected.course?.code ?? "Unknown course"} · Reported by {selected.user?.username ?? "Unknown student"} ({selected.user?.matriculationNumber ?? "No student ID"})</p>
        {question && <div className="flagged-answer-detail">
          {question.questionType === "MCQ" && <div className="flagged-options">{(["A", "B", "C", "D"] as const).map((letter) => {
            const option = question[`option${letter}`];
            return option ? <div className={question.correctAnswer === letter ? "correct" : ""} key={letter}><b>{letter}</b><span>{option}</span>{question.correctAnswer === letter && <small>Correct answer</small>}</div> : null;
          })}</div>}
          {(question.questionType === "TF" || question.questionType === "FBQ") && <p><strong>Correct answer:</strong> {question.questionType === "TF" ? question.correctAnswer === "A" ? "True" : "False" : question.correctAnswer}</p>}
        </div>}
        <div className="flagged-modal-actions">
          <button type="button" className="flagged-dismiss-button" disabled={pendingId !== null || selected.status !== "pending"} onClick={() => void resolve(selected, "dismissed")}>{pendingId === selected.id ? "Saving…" : "Dismiss"}</button>
          <button type="button" className="flagged-delete-button" disabled={pendingId !== null || selected.status !== "pending"} onClick={() => void resolve(selected, "deleted")}>{pendingId === selected.id ? "Saving…" : "Delete"}</button>
        </div>
      </section>
    </div>}
  </>;
}
