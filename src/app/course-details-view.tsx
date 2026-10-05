'use client';

import { useEffect, useState } from "react";
import Link from "next/link";

type Course = { id: string; code: string; title: string; description: string; questionCount: number; moduleCount?: number; favorite?: boolean };
type CourseDetails = {
  course: Course;
  banks: { id: string; year: number; questionCount: number }[];
  modules: { id: string; title: string; units: { id: string; title: string; content: string }[] }[];
};

export default function CourseDetailsView({ courseId, initialCourse, onBack, onStartMock, onAskAi, onFavorite }: {
  courseId: string;
  initialCourse?: Course;
  onBack?: () => void;
  onStartMock?: (year?: number, questionCount?: number) => void;
  onAskAi?: () => void;
  onFavorite?: (favorite: boolean) => void | Promise<void>;
}) {
  const [loaded, setLoaded] = useState<{ courseId: string; data?: CourseDetails; error?: string } | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/courses/${encodeURIComponent(courseId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Course details could not be loaded.");
        return data as CourseDetails;
      })
      .then((data) => { if (active) setLoaded({ courseId, data }); })
      .catch((error: Error) => { if (active) setLoaded({ courseId, error: error.message }); });
    return () => { active = false; };
  }, [courseId]);

  const current = loaded?.courseId === courseId ? loaded : null;
  const details = current?.data;
  const course = details?.course ?? initialCourse;
  const favorite = favoriteOverride ?? details?.course.favorite ?? initialCourse?.favorite ?? false;
  const banks = details?.banks.filter((bank) => bank.questionCount > 0) ?? [];

  async function toggleFavorite() {
    const nextFavorite = !favorite;
    if (onFavorite) await onFavorite(nextFavorite);
    else {
      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: nextFavorite }),
      });
      if (!response.ok) throw new Error("Could not update saved course.");
    }
    setFavoriteOverride(nextFavorite);
  }

  function browseQuestions() {
    document.getElementById("course-question-banks")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!course) return <div className="public-course-message" role={current?.error ? "alert" : "status"}>{current?.error ?? "Loading course..."}</div>;

  return <div className="course-detail">
    {onBack ? <button className="back-link" onClick={onBack}><span aria-hidden="true">←</span> Back to courses</button> : <Link className="back-link" href="/courses"><span aria-hidden="true">←</span> Back to courses</Link>}
    <section className="course-hero">
      <div className="course-hero-icon">{course.code.slice(0, 1)}</div>
      <div>
        <div className="course-code">{course.code}</div>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
        <div className="course-detail-meta"><span>{details?.course.questionCount ?? course.questionCount} questions available</span><span>{details?.modules.length ?? course.moduleCount ?? 0} learning modules</span></div>
      </div>
      <button type="button" className={`detail-favorite ${favorite ? "selected" : ""}`} aria-pressed={favorite} onClick={() => void toggleFavorite()}>{favorite ? "Saved" : "Save course"}</button>
      <nav className="course-detail-actions" aria-label="Course actions">
        <button className="button button-secondary" onClick={() => { const bank = banks[0]; onStartMock?.(bank?.year, bank?.questionCount); }}>Past-question practice</button>
        <button className="button" onClick={() => onStartMock?.()}>Attempt a mock <span aria-hidden="true">→</span></button>
        <button className="button button-light" onClick={browseQuestions}>Browse questions <span aria-hidden="true">→</span></button>
      </nav>
    </section>

    <div className="course-detail-grid">
      <section className="detail-main">
        <div className="section-row"><div><h2>Course modules</h2><p>Build understanding one module at a time.</p></div></div>
        {current?.error ? <p className="small-note" role="alert">{current.error}</p> : !details ? <p className="small-note" role="status">Loading course content…</p> : details.modules.length ? <div className="module-list">{details.modules.map((module, index) => {
          const expanded = expandedModuleId === module.id;
          return <section className="module-row" key={module.id}>
            <span className="module-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="module-row-content">
              <button type="button" className="module-expand" aria-expanded={expanded} onClick={() => { setExpandedModuleId(expanded ? null : module.id); setExpandedUnitId(null); }}>
                <strong>{module.title}</strong><small>{module.units.length} units</small>
              </button>
              {expanded && <div className="module-units">{module.units.map((unit) => <div className="module-unit" key={unit.id}>
                <button type="button" aria-expanded={expandedUnitId === unit.id} onClick={() => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id)}>{unit.title}</button>
                {expandedUnitId === unit.id && <p>{unit.content}</p>}
              </div>)}{!module.units.length && <small>No units available yet.</small>}</div>}
            </div>
            <span className="module-status">{index === 0 ? "In progress" : "Not started"}</span>
            <span className="icon" aria-hidden="true">⌄</span>
          </section>;
        })}</div> : <p className="small-note">No course modules available yet.</p>}
      </section>

      <aside className="detail-side" id="course-question-banks">
        <section className="side-card">
          <div className="side-card-title"><strong>Question banks</strong><span>{banks.length} {banks.length === 1 ? "year" : "years"}</span></div>
          {banks.map((bank) => <button type="button" className="year-row" key={bank.id} onClick={() => onStartMock?.(bank.year, bank.questionCount)}><span>{bank.year}</span><small>{bank.questionCount} questions</small><span className="icon" aria-hidden="true">→</span></button>)}
          {details && banks.length === 0 && <p className="small-note">No question banks available for this course yet.</p>}
          {!details && !current?.error && <p className="small-note">Loading question banks…</p>}
        </section>
      </aside>
    </div>

    <section className="course-detail-cta"><div><span className="eyebrow">STUDY SMARTER</span><h2>Try a 20-question mock to warm up, or ask the AI tutor about this course.</h2></div><div><button className="button" onClick={() => onStartMock?.()}>Set up a mock</button><button className="button button-light" onClick={onAskAi}>Ask AI about this course <span aria-hidden="true">→</span></button></div></section>
  </div>;
}