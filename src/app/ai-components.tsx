"use client";

import { FormEvent, useEffect, useState } from "react";
import { stripMarkdownAsterisks } from "@/lib/ai-text";

export type AiCourse = { id: string; code: string; title: string };
type Message = { role: "user" | "assistant"; content: string };
type Usage = { used: number; limit: number; remaining: number; day: string };
type PracticeQuestion = {
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
};

async function requestAi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || "The AI request could not be completed.");
  return data;
}

export function AiExplainButton({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [authoritativeAnswer, setAuthoritativeAnswer] = useState<{ letter: string; text: string; questionType: "MCQ" | "FBQ" | "TF" } | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);

  async function explain() {
    setOpen(true);
    if (explanation || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await requestAi<{ explanation: string; authoritativeAnswer: { letter: string; text: string; questionType: "MCQ" | "FBQ" | "TF" }; studentAnswer: string | null; usage: Usage }>("/api/ai/explain", { attemptId, questionId });
      setExplanation(stripMarkdownAsterisks(data.explanation));
      setAuthoritativeAnswer(data.authoritativeAnswer);
      setStudentAnswer(data.studentAnswer);
      setUsage(data.usage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load an AI explanation.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="ai-explain">
    <button className="ai-quiet-button" type="button" aria-expanded={open} onClick={() => open ? setOpen(false) : void explain()}>
      ✦ {explanation ? "AI explanation" : "Explain with AI"}
    </button>
    {open && <div className="ai-inline-panel" role="status">
      {loading ? <p>Preparing an explanation from your saved answer…</p> : error ? <p className="ai-error">{error}</p> : <><div className="ai-answer-source"><strong>Official answer: {authoritativeAnswer?.questionType !== "FBQ" ? `${authoritativeAnswer?.letter}. ` : ""}{authoritativeAnswer?.text}</strong><span>Your answer: {studentAnswer ?? "Unanswered"}</span></div><p>{explanation}</p>{usage && <small>{usage.remaining} AI requests remaining today</small>}</>}
    </div>}
  </div>;
}

type SavedReview = {
  attempt: { id: string };
  answers: {
    answer: { id: string; questionId: string; selectedAnswer: string | null; correctAnswer: string; questionType?: "MCQ" | "FBQ" | "TF" };
    question: { id: string; question: string; questionType?: "MCQ" | "FBQ" | "TF"; optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null; explanation?: string | null };
  }[];
};

export function MockQuestionReview({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<SavedReview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (attemptId === "demo") return;
    const controller = new AbortController();
    fetch(`/api/mock/${encodeURIComponent(attemptId)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({})) as SavedReview & { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not load saved questions.");
        return result;
      })
      .then(setData)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Could not load saved questions.");
      });
    return () => controller.abort();
  }, [attemptId]);

  if (attemptId === "demo") return <p className="ai-error" role="status">AI explanations are available for saved mock attempts only.</p>;
  if (error) return <p className="ai-error" role="status">{error}</p>;
  if (!data) return <p className="ai-loading" role="status">Loading saved questions…</p>;

  return <div className="review-list">{data.answers.map(({ answer, question }, index) => {
    const questionType = answer.questionType ?? question.questionType ?? "MCQ";
    const options = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD };
    const selectedText = questionType === "FBQ"
      ? answer.selectedAnswer ? options[answer.selectedAnswer as keyof typeof options] ?? answer.selectedAnswer : null
      : answer.selectedAnswer ? options[answer.selectedAnswer as keyof typeof options] : null;
    const correctText = questionType === "FBQ"
      ? options[answer.correctAnswer as keyof typeof options] ?? answer.correctAnswer
      : options[answer.correctAnswer as keyof typeof options];
    const isCorrect = questionType === "FBQ"
      ? Boolean(selectedText?.trim()) && selectedText?.trim().toLowerCase() === correctText?.trim().toLowerCase()
      : answer.selectedAnswer === answer.correctAnswer;
    return <article className={`review-card ${isCorrect ? "is-correct" : "is-wrong"}`} key={answer.id}>
      <div className="review-card-top"><span>QUESTION {String(index + 1).padStart(2, "0")} · {questionType}</span><strong>{isCorrect ? "Correct" : "Review this"}</strong></div>
      <h2>{question.question}</h2>
      {questionType !== "FBQ" && <div className="ai-question-options">{Object.entries(options).filter(([, text]) => text).map(([letter, text]) => <p key={letter}><strong>{letter}.</strong> {text}</p>)}</div>}
      <div className="review-answers"><div><small>Your answer</small><strong className={isCorrect ? "answer-good" : "answer-bad"}>{questionType !== "FBQ" && answer.selectedAnswer ? `${answer.selectedAnswer}. ` : ""}{selectedText ?? "Unanswered"}</strong></div><div><small>Correct answer · database</small><strong className="answer-good">{questionType !== "FBQ" ? `${answer.correctAnswer}. ` : ""}{correctText}</strong></div></div>
      {question.explanation && <div className="review-explanation"><span className="icon">✎</span><div><small>Stored explanation</small><p>{question.explanation}</p></div></div>}
      <AiExplainButton attemptId={attemptId} questionId={answer.questionId}/>
    </article>;
  })}</div>;
}

export function AiStudyAssistant({ courses, initialCourseId = "" }: { courses: AiCourse[]; initialCourseId?: string }) {
  const [courseId, setCourseId] = useState(initialCourseId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const selectedCourse = courses.find((course) => course.id === courseId);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || !selectedCourse || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const data = await requestAi<{ reply: string; usage: Usage }>("/api/ai/chat", {
        courseId,
        messages: nextMessages.slice(-20),
      });
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      setRemaining(data.usage.remaining);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The tutor could not respond.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="ai-tool-page">
    <div className="ai-tool-heading"><div className="eyebrow">STUDY ASSISTANT</div><h1>Ask your study tutor.</h1><p>Chat is grounded in stored course notes when available. Otherwise, it will identify when an answer is general background.</p></div>
    <label className="ai-course-picker">Course<select value={courseId} disabled={loading} onChange={(event) => { setCourseId(event.target.value); setMessages([]); setError(""); }}><option value="">Choose a course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
    <div className="ai-chat-log" aria-live="polite">
      {messages.length === 0 && <p className="ai-chat-empty">Choose a course and ask a study question to begin.</p>}
      {messages.map((message, index) => <article className={`ai-chat-message ${message.role}`} key={`${message.role}-${index}`}><strong>{message.role === "user" ? "You" : "Study tutor"}</strong><p>{message.content}</p></article>)}
      {loading && <div className="ai-chat-message assistant"><strong>Study tutor</strong><p>Thinking…</p></div>}
    </div>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {remaining !== null && <small className="ai-usage-note">{remaining} AI requests remaining today</small>}
    <form className="ai-chat-form" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={3000} placeholder={selectedCourse ? `Ask about ${selectedCourse.code}…` : "Choose a course first"} disabled={!selectedCourse || loading} required/><button className="button" type="submit" disabled={!selectedCourse || loading || !input.trim()}>Send <span aria-hidden="true">→</span></button></form>
  </section>;
}

export function AiPerformanceAnalysis() {
  const [analysis, setAnalysis] = useState("");
  const [courseResults, setCourseResults] = useState<{ course: string; attempts: number; averageScore: number; bestScore: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const data = await requestAi<{ analysis: string; data: { courseResults: typeof courseResults }; usage: Usage }>("/api/ai/performance", {});
      setAnalysis(data.analysis);
      setCourseResults(data.data.courseResults);
      setRemaining(data.usage.remaining);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not analyze your performance.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="ai-tool-page">
    <div className="ai-tool-heading"><div className="eyebrow">YOUR STUDY DATA</div><h1>Analyze my performance</h1><p>Reviews your submitted mock results only. This analysis cannot change scores or records.</p></div>
    <button className="button" type="button" onClick={analyze} disabled={loading}>{loading ? "Analyzing…" : "Analyze My Performance"} <span aria-hidden="true">→</span></button>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {analysis && <div className="ai-analysis-results"><h2>Personalized feedback</h2><p>{analysis}</p>{courseResults.length > 0 && <><h3>Results used</h3><div className="ai-course-results">{courseResults.map((item) => <div key={item.course}><strong>{item.course}</strong><span>{item.averageScore}% average · {item.bestScore}% best · {item.attempts} mocks</span></div>)}</div></>}{remaining !== null && <small>{remaining} AI requests remaining today</small>}</div>}
  </section>;
}

export function AiPracticePanel({
  courses,
  onSubmitted,
  onOpenReview,
}: {
  courses: AiCourse[];
  onSubmitted: (attemptId: string, result: { totalQuestions: number; correctAnswers: number; unanswered: number; percentage: number; timeUsed: number }, courseId: string) => void;
  onOpenReview: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, PracticeQuestion["correctAnswer"]>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuestions([]);
    setAttemptId("");
    setCurrentQuestion(0);
    setAnswers({});
    setChecked({});
    setSubmitted(false);
    try {
      const data = await requestAi<{ attemptId: string; practice: { questions: PracticeQuestion[] }; usage: Usage }>("/api/ai/practice", {
        courseId,
        topic: topic.trim(),
        count: Number(count),
      });
      if (!data.attemptId || !Array.isArray(data.practice?.questions) || data.practice.questions.length !== Number(count)) {
        throw new Error("The generated practice set was incomplete. Please try again.");
      }
      setQuestions(data.practice.questions);
      setAttemptId(data.attemptId);
      setRemaining(data.usage.remaining);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not generate practice questions.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPractice() {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await requestAi<{ result: { id: string; totalQuestions: number; correctAnswers: number; unanswered: number; percentage: number; timeUsed: number } }>("/api/ai/practice/submit", {
        attemptId,
        answers: Object.fromEntries(Object.entries(answers).map(([position, answer]) => [position, answer])),
      });
      setSubmitted(true);
      onSubmitted(data.result.id, data.result, courseId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save your practice results.");
    } finally {
      setSubmitting(false);
    }
  }

  const question = questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce(
    (total, item, index) => total + (answers[index] === item.correctAnswer ? 1 : 0),
    0,
  );
  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = questions.length - answeredCount;
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const selectedCourse = courses.find((course) => course.id === courseId);

  return <section className="ai-tool-page">
    <div className="ai-generated-banner"><span>✦</span><div><strong>AI-Generated Practice</strong><p>These are not official NOUN past questions and will never be added to your question bank. Submitted results are saved in Mock History as AI Practice.</p></div></div>
    <div className="ai-tool-heading"><div className="eyebrow">CUSTOM PRACTICE</div><h1>Build a practice set.</h1><p>Choose a course, topic, and question count. Generated questions stay separate from the official question bank.</p></div>
    <form className="ai-practice-form" onSubmit={generate}>
      <label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="">Choose a course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
      <label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={300} placeholder="e.g. opportunity cost" required/></label>
      <label>Questions<select value={count} onChange={(event) => setCount(event.target.value)}>{[10, 20, 30, 40, 50].map((value) => <option key={value} value={value}>{value} questions</option>)}</select></label>
      <button className="button" type="submit" disabled={loading || !courseId || !topic.trim()}>{loading ? "Generating…" : "Generate practice"} <span aria-hidden="true">→</span></button>
    </form>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {remaining !== null && <small className="ai-usage-note">{remaining} AI requests remaining today</small>}
    {questions.length > 0 && !submitted && question && <div className="ai-practice-session">
      <div className="ai-practice-session-heading">
        <div><strong>{selectedCourse ? `${selectedCourse.code} · ${selectedCourse.title}` : "Practice set"}</strong><small>{answeredCount} of {questions.length} answered</small></div>
        <progress value={currentQuestion + 1} max={questions.length} aria-label={`Question ${currentQuestion + 1} of ${questions.length}`} />
      </div>
      <main className="question-stage ai-practice-stage">
        <div className="question-topline">
          <span>QUESTION {String(currentQuestion + 1).padStart(2, "0")} <b>/ {String(questions.length).padStart(2, "0")}</b></span>
          <span>AI PRACTICE · {topic.trim()}</span>
        </div>
        <div className="question-card ai-practice-question-card">
          <span className="question-type-label">MULTIPLE CHOICE</span>
          <h1>{question.question}</h1>
          <div className="answer-options">
            {(["A", "B", "C", "D"] as const).map((letter) => (
              <label className={`answer-radio ${answers[currentQuestion] === letter ? "selected" : ""}`} key={letter}>
                <input
                  type="radio"
                  name={`ai-practice-question-${currentQuestion}`}
                  value={letter}
                  checked={answers[currentQuestion] === letter}
                  onChange={() => {
                    setAnswers((previous) => ({ ...previous, [currentQuestion]: letter }));
                    setChecked((previous) => ({ ...previous, [currentQuestion]: false }));
                  }}
                />
                <span>{letter}</span>
                <p>{question.options[letter]}</p>
              </label>
            ))}
          </div>
          <div className="ai-practice-check">
            <button
              className="ai-quiet-button"
              type="button"
              disabled={!answers[currentQuestion]}
              aria-expanded={!!checked[currentQuestion]}
              onClick={() => setChecked((previous) => ({ ...previous, [currentQuestion]: !previous[currentQuestion] }))}
            >
              {checked[currentQuestion] ? "Hide explanation" : "Check answer"}
            </button>
            {checked[currentQuestion] && <div className={`ai-practice-answer ${answers[currentQuestion] === question.correctAnswer ? "correct" : "incorrect"}`} role="status">
              <strong>{answers[currentQuestion] === question.correctAnswer ? "Correct!" : `Not quite — the answer is ${question.correctAnswer}.`}</strong>
              <p>{question.explanation}</p>
            </div>}
          </div>
        </div>
        <div className="question-footer ai-practice-footer">
          <button className="button button-light" type="button" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((value) => Math.max(0, value - 1))}>← Previous</button>
          {currentQuestion === questions.length - 1 ? (
            <button className="button" type="button" onClick={submitPractice} disabled={submitting}>{submitting ? "Saving results…" : "Submit Practice Set"} <span aria-hidden="true">→</span></button>
          ) : (
            <button className="button" type="button" onClick={() => setCurrentQuestion((value) => Math.min(questions.length - 1, value + 1))}>Next <span aria-hidden="true">→</span></button>
          )}
        </div>
      </main>
    </div>}
    {questions.length > 0 && submitted && <div className="ai-practice-results">
      <div className="ai-practice-result-hero">
        <div className="eyebrow">PRACTICE COMPLETE</div>
        <h2>Your results</h2>
        <strong className="ai-practice-score">{correctCount}<span> / {questions.length}</span></strong>
        <p>{percentage}% score · {answeredCount} answered · {unansweredCount} unanswered</p>
        <div className="ai-practice-breakdown">
          <span><strong>{correctCount}</strong> Correct</span>
          <span><strong>{incorrectCount}</strong> Incorrect</span>
          <span><strong>{unansweredCount}</strong> Unanswered</span>
        </div>
      </div>
      <div className="ai-practice-review">
        <div className="section-row"><div><h2>Answer key review</h2><p>Review your selections and explanations.</p></div></div>
        {questions.map((item, index) => {
          const selected = answers[index];
          const isCorrect = selected === item.correctAnswer;
          return <article className={`ai-practice-review-item ${selected ? (isCorrect ? "correct" : "incorrect") : "unanswered"}`} key={`${index}-${item.question}`}>
            <div className="eyebrow">QUESTION {String(index + 1).padStart(2, "0")} · {selected ? (isCorrect ? "CORRECT" : "INCORRECT") : "UNANSWERED"}</div>
            <h3>{item.question}</h3>
            <p><strong>Your answer:</strong> {selected ? `${selected}. ${item.options[selected]}` : "Not answered"}</p>
            <p><strong>Correct answer:</strong> {item.correctAnswer}. {item.options[item.correctAnswer]}</p>
            <div className="ai-practice-answer"><strong>Explanation</strong><p>{item.explanation}</p></div>
          </article>;
        })}
      </div>
      <button className="button button-secondary" type="button" onClick={onOpenReview}>Open saved attempt review <span aria-hidden="true">→</span></button>
      <button className="button" type="button" onClick={() => { setQuestions([]); setAnswers({}); setChecked({}); setSubmitted(false); setCurrentQuestion(0); }}>Create another practice set <span aria-hidden="true">→</span></button>
    </div>}
  </section>;
}
