'use client';

import { useEffect, useMemo, useState } from "react";

type Course = { id: string; code: string; title: string; description: string; questionCount: number };
type Attempt = { attempt: { id: string; totalQuestions: number; correctAnswers: number; unanswered: number; percentage: number; startedAt: string; timeUsed: number }; course: Course };
type DashboardData = {
  attempts: Attempt[];
  metrics: { mocksCompleted: number; averageScore: number };
  continueStudying: null | { course: Course; viewedUnits: number; totalUnits: number; progressPercent: number; activeModuleTitle: string | null };
};

async function loadJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load your study data.");
  return data as T;
}

function CourseIcon({ code }: { code: string }) {
  return <span className="attempt-course-icon">{code[0] || "C"}</span>;
}

export function StudentDashboard({ user, onView, onCourse, onViewAll, onAttempt, savedCount }: {
  user: { username: string };
  onView: (view: "courses" | "saved" | "history") => void;
  onCourse: (course: Course) => void;
  onViewAll: () => void;
  onAttempt: (item: Attempt) => void;
  savedCount: number;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJson<DashboardData>("/api/dashboard").then(setData).catch((loadError: Error) => setError(loadError.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const active = data?.continueStudying;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <div className="dashboard-page">
    <div className="dashboard-top"><div><p className="date-line">{today}</p><h1>Welcome back, {user.username} <span className="wave">✦</span></h1><p className="heading-muted">Ready for a little progress today?</p></div><button className="button button-secondary" onClick={() => onView("courses")}><span aria-hidden="true">⌕</span> Find a course</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="metric-grid">
      <div className="metric-card"><div className="metric-icon green">✓</div><div><span>Mocks completed</span><strong>{data?.metrics.mocksCompleted ?? "—"}</strong><small>Submitted mock exams</small></div></div>
      <div className="metric-card"><div className="metric-icon blue">↗</div><div><span>Average score</span><strong>{data ? `${data.metrics.averageScore}%` : "—"}</strong><small>Across completed mocks</small></div></div>
      <button className="metric-card clickable" onClick={() => onView("saved")}><div className="metric-icon orange">♡</div><div><span>Saved courses</span><strong>{savedCount}</strong><small>In your study space</small></div></button>
    </div>
    <div className="workspace-grid"><section className="main-column">
      <div className="section-row"><div><h2>Continue studying</h2><p>Pick up from the course you last opened.</p></div><button className="link-button" onClick={onViewAll}>View all courses <span aria-hidden="true">→</span></button></div>
      {active ? <div className="continue-card"><div className="continue-course-icon">{active.course.code[0]}</div><div className="continue-content"><div className="course-code">{active.course.code}{active.activeModuleTitle ? ` · ${active.activeModuleTitle}` : " · Recently opened"}</div><h3>{active.course.title}</h3><div className="progress-line"><span style={{ width: `${active.progressPercent}%` }}/></div><small>{active.viewedUnits} of {active.totalUnits} units opened · {active.progressPercent}%</small></div><button className="button" onClick={() => onCourse(active.course)}>Continue <span aria-hidden="true">→</span></button></div> : <div className="continue-card continue-empty"><div className="continue-content"><h3>{data ? "Choose a course to get started" : "Loading your study progress…"}</h3><small>{data ? "Your recently opened course will appear here." : ""}</small></div></div>}
      <div className="section-row gap-top"><div><h2>Recently attempted</h2><p>Your latest completed mock exams.</p></div><button className="link-button" onClick={() => onView("history")}>View history <span aria-hidden="true">→</span></button></div>
      <div className="attempt-list">{data?.attempts.map((item) => <button className="attempt-row" key={item.attempt.id} onClick={() => onAttempt(item)}><CourseIcon code={item.course.code}/><span className="attempt-info"><strong>{item.course.code}</strong><small>{item.course.title}</small></span><span className="attempt-date">{new Date(item.attempt.startedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span><span className="attempt-score"><strong>{item.attempt.correctAnswers}/{item.attempt.totalQuestions}</strong><small>{item.attempt.percentage}%</small></span><span aria-hidden="true">→</span></button>)}{data && !data.attempts.length && <div className="empty-state"><h3>No completed mocks yet</h3><p>Your results will appear here after your first mock.</p></div>}</div>
    </section><aside className="right-column"><div className="progress-card"><div className="section-row"><div><h2>Study progress</h2><p>Across your active course.</p></div></div>{active ? <><strong>{active.progressPercent}%</strong><div className="progress-line"><span style={{ width: `${active.progressPercent}%` }}/></div><small>{active.viewedUnits} of {active.totalUnits} units opened</small></> : <p className="small-note">Open a course unit to start tracking your progress.</p>}</div><div className="favorites-mini"><div className="section-row"><div><h2>Saved courses</h2><p>{savedCount} in your library</p></div><button className="link-button" onClick={() => onView("saved")}>Open <span aria-hidden="true">→</span></button></div></div></aside></div>
  </div>;
}

export function StudentHistory({ onOpen }: { onOpen: (item: Attempt) => void }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJson<{ attempts: Attempt[] }>("/api/mock/history").then((data) => setAttempts(data.attempts)).catch((loadError: Error) => setError(loadError.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matches = attempts.filter((item) => `${item.course.code} ${item.course.title}`.toLowerCase().includes(text));
    return text ? matches.sort((first, second) => Number(`${second.course.code} ${second.course.title}`.toLowerCase().startsWith(text)) - Number(`${first.course.code} ${first.course.title}`.toLowerCase().startsWith(text))) : matches;
  }, [attempts, query]);

  return <div><div className="page-heading"><div><div className="eyebrow">YOUR PRACTICE JOURNEY</div><h1>Mock history</h1><p>Review every attempt and see how your confidence is building.</p></div></div>
    <div className="student-history-search"><div className="history-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} placeholder="Search course history" aria-label="Search course history"/><span className="search-result-count">{filtered.length}</span></label></div>
      {focused && query.trim() && <div className="autocomplete history-autocomplete" role="listbox" aria-label="Matching course history">{filtered.slice(0, 8).map((item) => <button type="button" role="option" aria-selected={false} key={item.attempt.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setFocused(false); onOpen(item); }}><span className="mini-course-icon">{item.course.code[0]}</span><span><strong>{item.course.code}</strong><small>{item.course.title}</small></span></button>)}{!filtered.length && <div className="autocomplete-empty">No results found</div>}</div>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="history-card"><div className="history-head"><span>Course</span><span>Date attempted</span><span>Result</span><span/></div>{filtered.map((item) => <button className="history-row" key={item.attempt.id} onClick={() => onOpen(item)}><span className="history-course"><i className="course-icon-small blue">{item.course.code[0]}</i><span><strong>{item.course.code}</strong><small>{item.course.title}</small></span></span><span>{new Date(item.attempt.startedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span><span className="history-result"><strong>{item.attempt.correctAnswers}/{item.attempt.totalQuestions}</strong><small>{item.attempt.percentage}% score</small></span><span aria-hidden="true">→</span></button>)}{!error && !filtered.length && <div className="empty-state"><h3>{query ? "No matching attempts" : "No mock history yet"}</h3><p>{query ? "Try a different course code or title." : "Completed mock exams will appear here."}</p></div>}</div>
  </div>;
}

type CourseContent = {
  course: Course;
  banks: { id: string; year: number; questionCount: number }[];
  modules: { id: string; title: string; units: { id: string; title: string; content: string }[] }[];
};

export function StudentCourseContent({ course, onMock, onBack }: { course: Course; onMock: (year?: number, availableQuestions?: number) => void; onBack: () => void }) {
  const [data, setData] = useState<CourseContent | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJson<CourseContent>(`/api/courses/${encodeURIComponent(course.id)}`).then(setData).catch((loadError: Error) => setError(loadError.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [course.id]);

  const activeModule = data?.modules.find((module) => module.id === moduleId) ?? null;
  const activeUnit = activeModule?.units.find((unit) => unit.id === unitId) ?? null;

  async function track(nextModuleId?: string, nextUnitId?: string) {
    await fetch("/api/study-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, moduleId: nextModuleId, unitId: nextUnitId }),
    }).catch(() => undefined);
  }

  return <div className="course-content-page">
    <button className="back-link" onClick={() => activeUnit ? setUnitId(null) : activeModule ? setModuleId(null) : onBack()}>← {activeUnit ? "Back to units" : activeModule ? "Back to modules" : "Back to courses"}</button>
    <header className="course-content-heading"><span className="course-code">{course.code}</span><h1>{course.title}</h1><p>{course.description}</p><div className="course-content-actions"><span>{data?.modules.length ?? "—"} modules</span><span>{data?.course.questionCount ?? course.questionCount} questions</span><button className="button" onClick={() => onMock()}>Start a mock <span aria-hidden="true">→</span></button></div></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {data && !activeModule && <>
      <section className="course-content-section"><div className="section-row"><div><h2>Course modules</h2><p>Choose a module to view its units.</p></div></div><div className="database-module-list">{data.modules.map((module, index) => <button className="database-module-row" key={module.id} onClick={() => { setModuleId(module.id); void track(module.id); }}><span>{index + 1}.</span><strong>{module.title}</strong><small>{module.units.length} units</small><span aria-hidden="true">›</span></button>)}{!data.modules.length && <div className="empty-state"><h3>No modules available</h3><p>Course materials will appear here when they are added.</p></div>}</div></section>
      <section className="course-content-section"><div className="section-row"><div><h2>Question banks</h2><p>Choose a year to practise questions from that bank.</p></div></div><div className="database-bank-list">{data.banks.map((bank) => <button key={bank.id} disabled={!bank.questionCount} onClick={() => onMock(bank.year, bank.questionCount)}><strong>{bank.year}</strong><span>{bank.questionCount} questions</span><span aria-hidden="true">→</span></button>)}{!data.banks.length && <p className="small-note">No past-question banks are available for this course yet.</p>}</div></section>
    </>}
    {activeModule && !activeUnit && <section className="course-content-section"><div className="section-row"><div><h2>{activeModule.title}</h2><p>{activeModule.units.length} units</p></div></div><div className="database-unit-list">{activeModule.units.map((unit, index) => <button key={unit.id} onClick={() => { setUnitId(unit.id); void track(activeModule.id, unit.id); }}><span>{index + 1}.</span><strong>{unit.title}</strong><span aria-hidden="true">›</span></button>)}{!activeModule.units.length && <div className="empty-state"><h3>No units available</h3><p>Study units will appear here when they are added.</p></div>}</div></section>}
    {activeUnit && <article className="database-unit-content"><div className="eyebrow">{activeModule?.title}</div><h2>{activeUnit.title}</h2><div>{activeUnit.content}</div></article>}
    {!data && !error && <div className="loading-state"><span className="loader"/> Loading course content…</div>}
  </div>;
}

type CourseRequest = { id: string; requestText: string; courseCode?: string; courseTitle?: string; status: string; createdAt: string };
type CourseMatch = { id: string; code: string; title: string };

type ProfileIconName = "user" | "id" | "calendar" | "phone" | "lock" | "clock" | "check" | "bell" | "chevron";

function ProfileIcon({ name, size = 18 }: { name: ProfileIconName; size?: number }) {
  const icons = {
    user: <><circle cx="12" cy="8" r="3.25"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    id: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.6"/><path d="M5.8 15a2.4 2.4 0 0 1 4.4 0M13 10h5M13 14h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    phone: <path d="M7 3h3l1.5 4-2 1.5a14 14 0 0 0 6 6l1.5-2 4 1.5v3c0 1-1 2-2 2C10 19 5 14 5 5c0-1 1-2 2-2Z"/>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 8-3 9h18s-3-2-3-9M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function StudentProfileShield() {
  return <svg className="student-profile-shield-art" viewBox="0 0 180 160" role="img" aria-label="Protected account">
    <path d="M90 10 145 31v39c0 35-21 58-55 76C56 128 35 105 35 70V31L90 10Z" fill="#e7f2e9" stroke="#bdd9c4" strokeWidth="2"/>
    <path d="M90 24 132 40v30c0 27-15 45-42 61-27-16-42-34-42-61V40l42-16Z" fill="#f8fbf8"/>
    <rect x="70" y="66" width="40" height="34" rx="8" fill="#148253"/>
    <path d="M79 66v-8a11 11 0 0 1 22 0v8" fill="none" stroke="#148253" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="90" cy="82" r="3" fill="white"/><path d="M90 85v6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="132" cy="105" r="19" fill="#fff" stroke="#d2e6d6" strokeWidth="2"/>
    <path d="m124 105 5 5 10-11" fill="none" stroke="#168253" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="43" cy="53" r="3" fill="#91c5a0"/><circle cx="143" cy="63" r="4" fill="#b2d8ba"/><path d="M31 113h16m86-5h17" stroke="#c6dfcb" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function TrashIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
}

export function ExitIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><polyline points="14 17 19 12 14 7"/><line x1="9" y1="12" x2="19" y2="12"/></svg>;
}

export function NotificationBellIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M20 4c1.5 1.5 2 3.5 2 5"/></svg>;
}

export function StudentRequests({ onBack }: { onBack: () => void }) {
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [requests, setRequests] = useState<CourseRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicateCourse, setDuplicateCourse] = useState(false);
  const [lookupField, setLookupField] = useState<"code" | "title" | null>(null);
  const [courseSuggestionResults, setCourseSuggestionResults] = useState<CourseMatch[]>([]);
  const activeLookupQuery = (lookupField === "title" ? courseTitle : courseCode).trim().toLowerCase();
  const courseSuggestions = courseSuggestionResults.filter((course) => activeLookupQuery.length >= 2 && `${course.code} ${course.title}`.toLowerCase().includes(activeLookupQuery));

  async function refresh() {
    const data = await loadJson<{ requests: CourseRequest[] }>("/api/requests");
    setRequests(data.requests);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { refresh().catch((loadError: Error) => setError(loadError.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const codeQuery = courseCode.trim();
    const titleQuery = courseTitle.trim();
    const query = lookupField === "title" ? titleQuery : codeQuery;
    if (!lookupField || query.length < 2) return;
    let active = true;
    loadJson<{ courses: CourseMatch[] }>(`/api/courses?q=${encodeURIComponent(query)}`).then((result) => {
      if (!active) return;
      const matches = result.courses;
      setCourseSuggestionResults(matches.slice(0, 8));
      setDuplicateCourse(lookupField === "title"
        ? matches.some((course) => course.title.toLowerCase() === titleQuery.toLowerCase())
        : matches.some((course) => course.code.toLowerCase() === codeQuery.toLowerCase()));
    }).catch(() => {
      if (active) setCourseSuggestionResults([]);
    });
    return () => { active = false; };
  }, [courseCode, courseTitle, lookupField]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (duplicateCourse) { setError("This course is already on the database"); return; }
    setLoading(true);
    try {
      const data = await loadJson<{ request: CourseRequest }>("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseCode, courseTitle }) });
      setRequests((current) => [data.request, ...current]);
      setCourseCode("");
      setCourseTitle("");
      try { await refresh(); }
      catch { setError("Request submitted, but the list could not be refreshed. Reload this page to sync its status."); }
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not submit request."); }
    finally { setLoading(false); }
  }

  return <div className="student-requests-page"><div className="page-heading"><div><div className="eyebrow">GROW THE LIBRARY</div><h1>Request a course</h1><p>Share the course code and title so we can review your request.</p></div></div>
    <div className="request-layout"><section className="request-card"><span className="request-card-icon">＋</span><h2>What should we add?</h2><form onSubmit={submit}><label>Course Code<div className="request-course-lookup"><input required maxLength={20} pattern="[A-Za-z0-9-]{2,20}" value={courseCode} onFocus={() => setLookupField("code")} onChange={(event) => { setCourseCode(event.target.value.toUpperCase()); setLookupField("code"); setDuplicateCourse(false); setError(""); }} placeholder="e.g. ECO123" />{lookupField === "code" && courseCode.trim().length >= 2 && <div className="request-course-suggestions" role="listbox">{courseSuggestions.map((course) => <button type="button" role="option" aria-selected={false} key={course.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCourseCode(course.code); setCourseTitle(course.title); setDuplicateCourse(true); setLookupField(null); }}><strong>{course.code}</strong><span>{course.title}</span></button>)}{!courseSuggestions.length && <div className="autocomplete-empty">No results found</div>}</div>}</div></label><label>Course Title<div className="request-course-lookup"><input required maxLength={160} value={courseTitle} onFocus={() => setLookupField("title")} onChange={(event) => { setCourseTitle(event.target.value); setLookupField("title"); setDuplicateCourse(false); setError(""); }} placeholder="e.g. Introduction to Economics" />{lookupField === "title" && courseTitle.trim().length >= 2 && <div className="request-course-suggestions" role="listbox">{courseSuggestions.map((course) => <button type="button" role="option" aria-selected={false} key={course.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCourseCode(course.code); setCourseTitle(course.title); setDuplicateCourse(true); setLookupField(null); }}><strong>{course.code}</strong><span>{course.title}</span></button>)}{!courseSuggestions.length && <div className="autocomplete-empty">No results found</div>}</div>}</div></label>{duplicateCourse && <div className="form-error" role="alert">This course is already on the database</div>}{error && !duplicateCourse && <div className="form-error" role="alert">{error}</div>}<button className="button" type="submit" disabled={loading || duplicateCourse}>{loading ? "Submitting…" : "Submit request"}</button></form></section>
      <section className="previous-requests"><div className="section-row"><div><h2>Your requests</h2><p>Current status of each course suggestion.</p></div><span className="request-count">{requests.length}</span></div>{requests.map((item) => <div className="request-row" key={item.id}><div><strong>{item.courseCode ? `${item.courseCode} ${item.courseTitle}` : item.requestText}</strong><small>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</small></div><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span></div>)}{!requests.length && <div className="empty-state"><h3>No requests yet</h3><p>Your course suggestions will appear here.</p></div>}</section></div>
    <button className="back-link request-back" onClick={onBack}>← Return to dashboard</button>
  </div>;
}

export function StudentProfile({ user, onSave, onDelete, onViewActivity }: {
  user: { username: string; matriculationNumber: string; phoneNumber: string | null; createdAt: string; isActive: boolean };
  onSave: (phone: string) => Promise<void>;
  onDelete: () => void;
  onViewActivity: () => void;
}) {
  const [phone, setPhone] = useState(user.phoneNumber ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [studyReminders, setStudyReminders] = useState(true);
  const [accountUpdates, setAccountUpdates] = useState(true);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<Date | null>(null);
  const sessionStartedAt = new Date();
  const createdAt = new Date(user.createdAt);
  const accountCreated = `${createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })}`;

  async function save() {
    const trimmedPhone = phone.trim();
    const digits = trimmedPhone.replace(/\D/g, "");
    if (trimmedPhone && (!/^\+?[0-9().\s-]+$/.test(trimmedPhone) || digits.length < 7 || digits.length > 15)) {
      setError("Enter a valid phone number with 7 to 15 digits.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmedPhone);
      setPhone(trimmedPhone);
      setSaved(true);
      setProfileUpdatedAt(new Date());
      setEditingPhone(false);
    } catch (saveError) {
      setSaved(false);
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally { setSaving(false); }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) { setPasswordError("Use at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setPasswordBusy(true);
    try {
      await loadJson("/api/auth/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user.username, matriculationNumber: user.matriculationNumber, newPassword, confirmPassword }) });
      setPasswordSaved(true);
      setPasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (passwordSubmitError) { setPasswordError(passwordSubmitError instanceof Error ? passwordSubmitError.message : "Could not change password."); }
    finally { setPasswordBusy(false); }
  }

  function saveNotificationPreferences() {
    window.localStorage.setItem("nounstudyhub-notification-preferences", JSON.stringify({ studyReminders, accountUpdates }));
    setPreferencesSaved(true);
    setPreferencesOpen(false);
  }

  function openNotificationPreferences() {
    const stored = window.localStorage.getItem("nounstudyhub-notification-preferences");
    if (stored) {
      try {
        const preferences = JSON.parse(stored) as { studyReminders?: boolean; accountUpdates?: boolean };
        if (typeof preferences.studyReminders === "boolean") setStudyReminders(preferences.studyReminders);
        if (typeof preferences.accountUpdates === "boolean") setAccountUpdates(preferences.accountUpdates);
      } catch { window.localStorage.removeItem("nounstudyhub-notification-preferences"); }
    }
    setPreferencesOpen(true);
  }

  return <div className="student-profile-page">
    <header className="student-profile-title">
      <h1>My profile</h1>
      <p>Keep your details up to date.</p>
    </header>
    <div className="student-profile-grid">
      <section className="student-profile-panel student-account-panel" aria-labelledby="student-account-heading">
        <div className="student-account-banner">
          <div className="student-account-identity"><span className="student-account-initial">{user.username.slice(0, 1).toUpperCase()}</span><span><strong>{user.username}</strong><small>Student account</small></span></div>
          <span className={`student-active-pill ${user.isActive ? "" : "inactive"}`}><i/>{user.isActive ? "Active" : "Inactive"}</span>
        </div>
        <h2 className="student-profile-section-title" id="student-account-heading">Account details</h2>
        <div className="student-account-rows">
          <div className="student-account-row"><div className="student-account-label"><ProfileIcon name="user"/><span>Username</span></div><strong>{user.username}</strong></div>
          <div className="student-account-row student-matric-row"><div className="student-account-label"><ProfileIcon name="id"/><span>Matriculation number</span></div><span className="student-account-value">{user.matriculationNumber}</span><small>One account per matriculation number</small></div>
          <div className="student-account-row"><div className="student-account-label"><ProfileIcon name="calendar"/><span>Date joined</span></div><strong>{createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</strong></div>
          <div className="student-account-row student-phone-row"><div className="student-account-label"><ProfileIcon name="phone"/><span>Phone number <small>Optional</small></span></div><form className="student-phone-inline-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>{editingPhone ? <input aria-label="Phone number" type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setSaved(false); setError(""); }} placeholder="Add a phone number"/> : <strong>{phone || "+ Add phone number"}</strong>}<button type={editingPhone ? "submit" : "button"} className="student-add-phone" disabled={saving} onClick={() => { if (!editingPhone) { setPhone(user.phoneNumber ?? ""); setEditingPhone(true); setError(""); } }}>{saving ? "Saving…" : editingPhone ? "Save" : "Edit"}</button></form></div>
        </div>
        {(saved || error) && <div className="student-profile-feedback">{saved && <span role="status">Phone number updated.</span>}{error && <span role="alert">{error}</span>}</div>}
        {passwordSaved && <div className="student-profile-feedback" role="status">Password updated successfully.</div>}
      </section>

      <div className="student-profile-side">
        <section className="student-profile-panel student-privacy-panel">
          <span className="student-privacy-lock"><ProfileIcon name="lock" size={17}/></span>
          <h2>Your data stays yours</h2>
          <p>Your account details are used only to personalise your study experience.</p>
          <StudentProfileShield/>
        </section>
        <section className="student-profile-panel student-status-panel">
          <div><h2>Account status</h2><span className={`student-active-pill ${user.isActive ? "" : "inactive"}`}><i/>{user.isActive ? "Active" : "Inactive"}</span></div>
          <p>{user.isActive ? "You have access to all student features on NounStudyHub." : "Your account access is currently inactive."}</p>
        </section>
      </div>

      <section className="student-profile-panel student-activity-panel" id="student-profile-activity">
        <header className="student-profile-card-heading"><h2><ProfileIcon name="clock"/>Recent activity</h2></header>
        <div className="student-activity-list">
          <div className="student-activity-row"><span className="student-activity-check"><ProfileIcon name="check" size={17}/></span><span><strong>Logged in successfully</strong><small>Current session, {sessionStartedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></span></div>
          <div className="student-activity-row"><span className="student-activity-check"><ProfileIcon name="check" size={17}/></span><span><strong>Profile updated</strong><small>{profileUpdatedAt ? `Today, ${profileUpdatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "No recent updates"}</small></span></div>
          <div className="student-activity-row"><span className="student-activity-check"><ProfileIcon name="check" size={17}/></span><span><strong>Account created</strong><small>{accountCreated}</small></span></div>
        </div>
        <button type="button" className="student-profile-card-link" onClick={onViewActivity}>View all activity <span aria-hidden="true">→</span></button>
      </section>

      <section className="student-profile-panel student-quick-actions-panel">
        <header className="student-profile-card-heading"><h2>Quick actions</h2></header>
        <div className="student-quick-actions">
          <button type="button" className="student-quick-action" onClick={() => { setPasswordError(""); setPasswordOpen(true); }}><span className="student-quick-action-icon"><ProfileIcon name="lock"/></span><span>Change password</span><ProfileIcon name="chevron"/></button>
          <button type="button" className="student-quick-action" onClick={openNotificationPreferences}><span className="student-quick-action-icon"><ProfileIcon name="bell"/></span><span>Notification preferences</span><ProfileIcon name="chevron"/></button>
          <button type="button" className="student-quick-action student-delete-action" onClick={() => { if (window.confirm("Permanently delete your account and all associated study data? This cannot be undone. Your username will become available again.")) onDelete(); }}><span className="student-quick-action-icon"><TrashIcon/></span><span>Delete account</span><ProfileIcon name="chevron"/></button>
        </div>
        {preferencesSaved && <p className="student-profile-feedback" role="status">Notification preferences saved on this device.</p>}
      </section>
    </div>
    <footer className="student-profile-footer">© 2026 NounStudyHub. All rights reserved.</footer>

    {passwordOpen && <div className="student-profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordOpen(false); }}><section className="student-profile-modal" role="dialog" aria-modal="true" aria-labelledby="student-password-title"><button type="button" className="student-profile-modal-close" aria-label="Close" onClick={() => setPasswordOpen(false)}>×</button><span className="student-privacy-lock"><ProfileIcon name="lock"/></span><h2 id="student-password-title">Change password</h2><p>Choose a new password with at least 8 characters.</p><form onSubmit={(event) => void changePassword(event)}><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/></label>{passwordError && <span className="student-profile-form-error" role="alert">{passwordError}</span>}<button className="student-profile-primary" type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</button></form></section></div>}
    {preferencesOpen && <div className="student-profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreferencesOpen(false); }}><section className="student-profile-modal student-preferences-modal" role="dialog" aria-modal="true" aria-labelledby="student-preferences-title"><button type="button" className="student-profile-modal-close" aria-label="Close" onClick={() => setPreferencesOpen(false)}>×</button><span className="student-privacy-lock"><ProfileIcon name="bell"/></span><h2 id="student-preferences-title">Notification preferences</h2><p>Choose which updates you would like to receive on this device.</p><label className="student-preference-toggle"><span><strong>Study reminders</strong><small>Updates about your study activity</small></span><input type="checkbox" checked={studyReminders} onChange={(event) => setStudyReminders(event.target.checked)}/></label><label className="student-preference-toggle"><span><strong>Account updates</strong><small>Important changes to your account</small></span><input type="checkbox" checked={accountUpdates} onChange={(event) => setAccountUpdates(event.target.checked)}/></label><button type="button" className="student-profile-primary" onClick={saveNotificationPreferences}>Save preferences</button></section></div>}
  </div>;
}

export type NotificationItem = { id: string; message: string; createdAt: string; readAt: string | null; link?: string | null };

export function NotificationCenter({ notifications, onSelect, variant }: {
  notifications: NotificationItem[];
  onSelect: (notification: NotificationItem) => void;
  variant: "student" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  return <div className={`notification-center ${variant}`}>
    <button className="notification-center-trigger" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <NotificationBellIcon/>{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}
    </button>
    {open && <section className="notification-center-panel" aria-label="Notifications">
      <header><div><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} unread` : "All caught up"}</small></div><button aria-label="Close notifications" onClick={() => setOpen(false)}>×</button></header>
      <div className="notification-center-list">{notifications.length ? notifications.map((notification) => <button key={notification.id} className={`notification-center-item ${notification.readAt ? "read" : "unread"}`} onClick={() => { setOpen(false); onSelect(notification); }}><span className="notification-center-dot"/><span><strong>{notification.message}</strong><small>{new Date(notification.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span></button>) : <p className="notification-center-empty">You&apos;re all caught up.</p>}</div>
    </section>}
  </div>;
}
