"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [authoritativeAnswer, setAuthoritativeAnswer] = useState<{ letter: string; text: string } | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);

  async function explain() {
    setOpen(true);
    if (explanation || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await requestAi<{ explanation: string; authoritativeAnswer: { letter: string; text: string }; studentAnswer: string | null; usage: Usage }>("/api/ai/explain", { attemptId, questionId });
      setExplanation(data.explanation);
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
      {loading ? <p>Preparing an explanation from your saved answer…</p> : error ? <p className="ai-error">{error}</p> : <><div className="ai-answer-source"><strong>Official answer: {authoritativeAnswer?.letter}. {authoritativeAnswer?.text}</strong><span>Your answer: {studentAnswer ?? "Unanswered"}</span></div><p>{explanation}</p>{usage && <small>{usage.remaining} AI requests remaining today</small>}</>}
    </div>}
  </div>;
}

type SavedReview = {
  attempt: { id: string };
  answers: {
    answer: { id: string; questionId: string; selectedAnswer: string | null; correctAnswer: string };
    question: { id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; explanation?: string | null };
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
    const options = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD };
    const selectedText = answer.selectedAnswer ? options[answer.selectedAnswer as keyof typeof options] : "Unanswered";
    const correctText = options[answer.correctAnswer as keyof typeof options];
    return <article className={`review-card ${answer.selectedAnswer === answer.correctAnswer ? "is-correct" : "is-wrong"}`} key={answer.id}>
      <div className="review-card-top"><span>QUESTION {String(index + 1).padStart(2, "0")}</span><strong>{answer.selectedAnswer === answer.correctAnswer ? "Correct" : "Review this"}</strong></div>
      <h2>{question.question}</h2>
      <div className="ai-question-options">{Object.entries(options).map(([letter, text]) => <p key={letter}><strong>{letter}.</strong> {text}</p>)}</div>
      <div className="review-answers"><div><small>Your answer</small><strong className={answer.selectedAnswer === answer.correctAnswer ? "answer-good" : "answer-bad"}>{answer.selectedAnswer ? `${answer.selectedAnswer}. ${selectedText}` : "Unanswered"}</strong></div><div><small>Correct answer · database</small><strong className="answer-good">{answer.correctAnswer}. {correctText}</strong></div></div>
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

export function AiPracticePanel({ courses }: { courses: AiCourse[] }) {
  const [courseId, setCourseId] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setQuestions([]);
    setRevealed({});
    try {
      const data = await requestAi<{ practice: { questions: PracticeQuestion[] }; usage: Usage }>("/api/ai/practice", {
        courseId,
        topic: topic.trim(),
        count: Number(count),
      });
      setQuestions(data.practice.questions);
      setRemaining(data.usage.remaining);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not generate practice questions.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="ai-tool-page">
    <div className="ai-generated-banner"><span>✦</span><div><strong>AI-Generated Practice</strong><p>Custom questions only. These are not official NOUN past questions and will not be saved to your question bank or mock history.</p></div></div>
    <div className="ai-tool-heading"><div className="eyebrow">CUSTOM PRACTICE</div><h1>Build a practice set.</h1><p>Choose a course, topic, and question count. Generated questions stay in this session only.</p></div>
    <form className="ai-practice-form" onSubmit={generate}>
      <label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="">Choose a course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}</select></label>
      <label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={300} placeholder="e.g. opportunity cost" required/></label>
      <label>Questions<select value={count} onChange={(event) => setCount(event.target.value)}>{[3, 5, 10].map((value) => <option key={value} value={value}>{value} questions</option>)}</select></label>
      <button className="button" type="submit" disabled={loading || !courseId || !topic.trim()}>{loading ? "Generating…" : "Generate practice"} <span aria-hidden="true">→</span></button>
    </form>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {remaining !== null && <small className="ai-usage-note">{remaining} AI requests remaining today</small>}
    {questions.length > 0 && <div className="ai-practice-list">{questions.map((question, index) => <article className="ai-practice-card" key={`${index}-${question.question}`}><div className="eyebrow">AI PRACTICE · QUESTION {String(index + 1).padStart(2, "0")}</div><h2>{question.question}</h2><ol type="A">{Object.entries(question.options).map(([letter, text]) => <li key={letter}>{text}</li>)}</ol><button className="ai-quiet-button" type="button" aria-expanded={!!revealed[index]} onClick={() => setRevealed((current) => ({ ...current, [index]: !current[index] }))}>{revealed[index] ? "Hide answer" : "Reveal answer"}</button>{revealed[index] && <div className="ai-practice-answer"><strong>Answer {question.correctAnswer}</strong><p>{question.explanation}</p></div>}</article>)}</div>}
  </section>;
}
