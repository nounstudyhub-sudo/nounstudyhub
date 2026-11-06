'use client';

import { useEffect, useMemo, useState } from "react";
import "./admin-content.css";
import { TrashIcon } from "../student-data-views";

type Section = "courses" | "summaries" | "questions";
type Course = { id: string; code: string; title: string; description: string; moduleCount: number; unitCount: number; questionCount: number };
type Module = { id: string; title: string; position: number; unitCount: number };
type Unit = { id: string; title: string; content: string };
type Bank = { id: string; year: number; questionCount: number };
type Dialog = { mode: "add" | "edit" | "view"; unit?: Unit };

const csvPrompt = `Convert the attached PDF question bank into CSV using exactly these columns: question,questionType,optionA,optionB,optionC,optionD,correctAnswer,explanation.
Identify if the question is Multiple Choice ('MCQ') or Fill-in-the-Blank ('FBQ').
For MCQs: Put the four options into optionA to optionD, and the correct option letter (A, B, C, or D) in correctAnswer.
For FBQs: Leave optionA to optionD empty, and put the exact missing word/phrase in correctAnswer.
In the explanation column, write one short sentence explaining the answer. Return only valid CSV data with the header row. Properly escape commas and quotation marks.`;

async function adminRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export default function AdminContentManager({ section, notify }: { section: Section; notify: (message: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [unitForm, setUnitForm] = useState({ title: "", content: "" });
  const [courseForm, setCourseForm] = useState({ code: "", title: "", description: "" });
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showQuestionImport, setShowQuestionImport] = useState(false);
  const [questionMode, setQuestionMode] = useState<"single" | "bulk">("bulk");
  const [singleQuestion, setSingleQuestion] = useState({ question: "", questionType: "MCQ" as "MCQ" | "FBQ", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", explanation: "" });
  const [questionYear, setQuestionYear] = useState(String(new Date().getFullYear()));
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refreshCourses() {
    const data = await adminRequest("/api/admin/courses");
    setCourses(data.courses);
    setSelectedCourse((current) => current ? data.courses.find((course: Course) => course.id === current.id) ?? current : current);
  }

  async function refreshAfterSave(message: string, refresh: () => Promise<void>) {
    try {
      await refresh();
      notify(message);
    } catch (error) {
      notify(`${message} The save succeeded, but the list refresh failed: ${error instanceof Error ? error.message : "Please reload."}`);
    }
  }

  async function runMutation(operation: () => Promise<void>, fallback: string) {
    if (saving) return;
    setSaving(true);
    try { await operation(); }
    catch (error) { notify(error instanceof Error ? error.message : fallback); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      adminRequest("/api/admin/courses").then((data) => setCourses(data.courses)).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sortedCourses = useMemo(() => [...courses].sort((a, b) => `${a.code} ${a.title}`.localeCompare(`${b.code} ${b.title}`)), [courses]);
  const matchingCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedCourses;
    return sortedCourses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(query)).sort((first, second) => {
      const firstStartsWith = `${first.code} ${first.title}`.toLowerCase().startsWith(query);
      const secondStartsWith = `${second.code} ${second.title}`.toLowerCase().startsWith(query);
      return Number(secondStartsWith) - Number(firstStartsWith) || `${first.code} ${first.title}`.localeCompare(`${second.code} ${second.title}`);
    });
  }, [search, sortedCourses]);

  async function openCourse(course: Course) {
    setSearchOpen(false);
    setBusy(true);
    try {
      if (section === "summaries") {
        const data = await adminRequest(`/api/admin/modules?courseId=${course.id}`);
        setModules(data.modules);
      }
      if (section === "questions") {
        const data = await adminRequest(`/api/admin/questions?courseId=${course.id}`);
        setBanks(data.banks);
      }
      setSelectedCourse(course);
      setSelectedModule(null);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not load course content."); }
    finally { setBusy(false); }
  }

  async function openModule(module: Module) {
    setBusy(true);
    try {
      const data = await adminRequest(`/api/admin/summaries?moduleId=${module.id}`);
      setUnits(data.summaries);
      setSelectedModule(module);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not load units."); }
    finally { setBusy(false); }
  }

  function backToCourses() {
    setSelectedCourse(null);
    setSelectedModule(null);
    setSearch("");
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Delete ${course.code} ${course.title} and all of its content?`)) return;
    await runMutation(async () => {
      await adminRequest(`/api/admin/courses?id=${course.id}`, { method: "DELETE" });
      setCourses((current) => current.filter((item) => item.id !== course.id));
      await refreshAfterSave("Course and its content deleted.", refreshCourses);
    }, "Could not delete course.");
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runMutation(async () => {
      const data = await adminRequest("/api/admin/courses", { method: "POST", body: JSON.stringify(courseForm) });
      setCourses((current) => [...current, { ...data.course, moduleCount: 0, unitCount: 0, questionCount: 0 }].sort((a, b) => `${a.code} ${a.title}`.localeCompare(`${b.code} ${b.title}`)));
      setCourseForm({ code: "", title: "", description: "" });
      setShowCourseForm(false);
      await refreshAfterSave("Course created successfully.", refreshCourses);
    }, "Could not create course.");
  }

  async function createModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;
    await runMutation(async () => {
      const data = await adminRequest("/api/admin/modules", { method: "POST", body: JSON.stringify({ courseId: selectedCourse.id, title: moduleTitle }) });
      setModules((current) => [...current, { ...data.module, unitCount: 0 }].sort((a, b) => a.position - b.position));
      setModuleTitle("");
      setDialog(null);
      await refreshAfterSave("Module added.", async () => {
        const modulesData = await adminRequest(`/api/admin/modules?courseId=${selectedCourse.id}`);
        setModules(modulesData.modules);
        await refreshCourses();
      });
    }, "Could not add module.");
  }

  async function deleteModule(module: Module) {
    if (!window.confirm(`Delete “${module.title}” and its units?`)) return;
    await runMutation(async () => {
      await adminRequest(`/api/admin/modules?id=${module.id}`, { method: "DELETE" });
      setModules((current) => current.filter((item) => item.id !== module.id));
      await refreshAfterSave("Module deleted.", async () => {
        const data = await adminRequest(`/api/admin/modules?courseId=${selectedCourse?.id}`);
        setModules(data.modules);
        await refreshCourses();
      });
    }, "Could not delete module.");
  }

  async function saveUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedModule || !dialog) return;
    const mode = dialog.mode;
    await runMutation(async () => {
      const data = await adminRequest("/api/admin/summaries", {
        method: mode === "edit" ? "PATCH" : "POST",
        body: JSON.stringify({ ...(dialog.mode === "edit" ? { id: dialog.unit?.id } : { moduleId: selectedModule.id }), ...unitForm }),
      });
      const saved = data as { summary: Unit };
      setUnits((current) => mode === "edit" ? current.map((unit) => unit.id === saved.summary.id ? saved.summary : unit) : [...current, saved.summary]);
      setDialog(null);
      await refreshAfterSave(mode === "edit" ? "Unit updated." : "Unit added.", async () => {
        const unitsData = await adminRequest(`/api/admin/summaries?moduleId=${selectedModule.id}`);
        setUnits(unitsData.summaries);
        await refreshCourses();
      });
    }, "Could not save unit.");
  }

  async function deleteUnit(unit: Unit) {
    if (!window.confirm(`Delete “${unit.title}”?`)) return;
    await runMutation(async () => {
      await adminRequest(`/api/admin/summaries?id=${unit.id}`, { method: "DELETE" });
      setUnits((current) => current.filter((item) => item.id !== unit.id));
      await refreshAfterSave("Unit deleted.", refreshCourses);
    }, "Could not delete unit.");
  }

  async function importQuestions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse) return;
    await runMutation(async () => {
      const quoteCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const singleCsv = [
        ["question", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "explanation"],
        [singleQuestion.question, singleQuestion.questionType, singleQuestion.questionType === "MCQ" ? singleQuestion.optionA : "", singleQuestion.questionType === "MCQ" ? singleQuestion.optionB : "", singleQuestion.questionType === "MCQ" ? singleQuestion.optionC : "", singleQuestion.questionType === "MCQ" ? singleQuestion.optionD : "", singleQuestion.correctAnswer, singleQuestion.explanation],
      ].map((row) => row.map(quoteCsv).join(",")).join("\n");
      const data = await adminRequest("/api/admin/import", { method: "POST", body: JSON.stringify({ courseId: selectedCourse.id, year: questionYear, csv: questionMode === "single" ? singleCsv : csv }) });
      setBanks((current) => {
        const year = Number(questionYear);
        const existing = current.find((bank) => bank.year === year);
        return existing
          ? current.map((bank) => bank.id === existing.id ? { ...bank, questionCount: bank.questionCount + data.imported } : bank)
          : [...current, { id: data.bankId, year, questionCount: data.imported }].sort((a, b) => a.year - b.year);
      });
      setCsv("");
      setSingleQuestion({ question: "", questionType: "MCQ", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", explanation: "" });
      setShowQuestionImport(false);
      await refreshAfterSave(`${data.imported} questions imported${data.invalid ? `; ${data.invalid} invalid rows skipped` : ""}.`, async () => {
        const bankData = await adminRequest(`/api/admin/questions?courseId=${selectedCourse.id}`);
        setBanks(bankData.banks);
        await refreshCourses();
      });
    }, "Question import failed.");
  }

  async function deleteBank(bank: Bank) {
    if (!window.confirm(`Delete the ${bank.year} question bank and all its questions?`)) return;
    await runMutation(async () => {
      await adminRequest(`/api/admin/questions?id=${bank.id}`, { method: "DELETE" });
      setBanks((current) => current.filter((item) => item.id !== bank.id));
      await refreshAfterSave("Question bank deleted.", refreshCourses);
    }, "Could not delete question bank.");
  }

  const heading = section === "courses" ? "Course library" : section === "summaries" ? "Course summaries" : "Questions";

  return <section className="admin-content-manager" aria-busy={saving}>
    {saving && <div className="admin-saving-status" role="status">Saving changes…</div>}
    <fieldset className="admin-manager-fieldset" disabled={saving}>
    {!selectedCourse ? <>
      <div className="admin-section-intro admin-manager-heading">
        <div><h2>{heading}</h2><p>{section === "courses" ? "Browse course content and manage the study catalogue." : section === "summaries" ? "Choose a course to organise its modules and study units." : "Choose a course to manage its past-question years."}</p></div>
        {section === "courses" && <button onClick={() => setShowCourseForm((value) => !value)}>{showCourseForm ? "Cancel" : "+ Add Course"}</button>}
      </div>
      <div className="admin-course-picker">
        <label htmlFor="course-search">Search courses</label>
        <input id="course-search" role="combobox" aria-autocomplete="list" aria-controls="admin-course-suggestions" aria-expanded={searchOpen} value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && matchingCourses[0]) { event.preventDefault(); if (section !== "courses") void openCourse(matchingCourses[0]); else setSearchOpen(false); } }} placeholder="Search by course code or name" autoComplete="off" />
        {searchOpen && <div id="admin-course-suggestions" className="admin-course-suggestions" role="listbox">{matchingCourses.slice(0, 8).map((course) => <button type="button" role="option" aria-selected={false} key={course.id} onMouseDown={(event) => event.preventDefault()} onClick={() => section === "courses" ? setSearchOpen(false) : void openCourse(course)}><strong>{course.code}</strong><span>{course.title}</span></button>)}{!matchingCourses.length && <span className="admin-empty">No results found</span>}</div>}
      </div>
      {showCourseForm && <form className="admin-create-form" onSubmit={createCourse}><div><label>Course code<input required maxLength={20} value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="ECO231" /></label><label>Course title<input required maxLength={160} value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Introduction to Economics" /></label><label>Description<input value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} placeholder="Short course description" /></label></div><button type="submit">Save course</button></form>}
      <div className="admin-course-list">{matchingCourses.map((course) => <article className="admin-course-row" key={course.id}>
        {section !== "courses" ? <button className="admin-course-row-main" onClick={() => void openCourse(course)}><strong>{course.code} {course.title}</strong><small>{section === "summaries" ? `${course.moduleCount} modules · ${course.unitCount} units` : `${course.questionCount} questions`}</small></button> : <div className="admin-course-row-main"><strong>{course.code} {course.title}</strong><small>{course.moduleCount} modules · {course.unitCount} units · {course.questionCount} questions</small></div>}
        {section === "courses" && <button className="admin-icon-button admin-delete-button" aria-label={`Delete ${course.code} ${course.title}`} title="Delete course" onClick={() => void deleteCourse(course)}><TrashIcon/></button>}
      </article>)}{!matchingCourses.length && <div className="admin-empty">No courses found.</div>}</div>
    </> : <>
      <button className="admin-text-back" onClick={selectedModule ? () => setSelectedModule(null) : backToCourses}>← {selectedModule ? selectedCourse.code : "All courses"}</button>
      <div className="admin-section-intro admin-manager-heading"><div><h2>{selectedCourse.code} {selectedCourse.title}{selectedModule ? ` / ${selectedModule.title}` : ""}</h2><p>{selectedModule ? `${units.length} units` : section === "summaries" ? `${modules.length} modules · ${selectedCourse.unitCount} units` : `${selectedCourse.questionCount} questions`}</p></div>
        {section === "summaries" && !selectedModule && <button onClick={() => setDialog({ mode: "add" })}>+ Add Module</button>}
        {section === "summaries" && selectedModule && <button onClick={() => { setUnitForm({ title: "", content: "" }); setDialog({ mode: "add" }); }}>+ Add Unit</button>}
        {section === "questions" && <button onClick={() => setShowQuestionImport((value) => !value)}>+ Add Questions</button>}
      </div>
      {busy && <div className="admin-empty">Loading…</div>}
      {section === "summaries" && !selectedModule && <div className="admin-course-list">{modules.map((module, index) => <article className="admin-course-row" key={module.id}><button className="admin-course-row-main" onClick={() => void openModule(module)}><strong>{index + 1}. {module.title}</strong><small>{module.unitCount} units</small></button><button className="admin-icon-button admin-delete-button" aria-label={`Delete module ${module.title}`} title="Delete module" onClick={() => void deleteModule(module)}><TrashIcon/></button></article>)}{!modules.length && <div className="admin-empty">No modules added yet.</div>}</div>}
      {section === "summaries" && selectedModule && <div className="admin-course-list">{units.map((unit, index) => <article className="admin-course-row" key={unit.id}><button className="admin-course-row-main" onClick={() => setDialog({ mode: "view", unit })}><strong>{index + 1}. {unit.title}</strong></button><div className="admin-row-actions"><button className="admin-icon-button" aria-label={`Edit ${unit.title}`} title="Edit unit" onClick={() => { setUnitForm({ title: unit.title, content: unit.content }); setDialog({ mode: "edit", unit }); }}>✎</button><button className="admin-icon-button admin-delete-button" aria-label={`Delete ${unit.title}`} title="Delete unit" onClick={() => void deleteUnit(unit)}><TrashIcon/></button></div></article>)}{!units.length && <div className="admin-empty">No units added yet.</div>}</div>}
      {section === "questions" && <>
        {showQuestionImport && <form className="admin-question-import" onSubmit={importQuestions}>
          <div className="admin-question-mode"><button type="button" aria-pressed={questionMode === "single"} onClick={() => setQuestionMode("single")}>One question</button><button type="button" aria-pressed={questionMode === "bulk"} onClick={() => setQuestionMode("bulk")}>Bulk CSV</button></div>
          <label>Question year<input required type="number" min="1900" max="2200" value={questionYear} onChange={(event) => setQuestionYear(event.target.value)} /></label>
          {questionMode === "bulk" ? <>
            <label>CSV file<input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCsv(await file.text()); }} /></label>
            <label className="admin-question-csv">CSV content<textarea required rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="question,questionType,optionA,optionB,optionC,optionD,correctAnswer,explanation" /></label>
            <div className="admin-prompt-helper"><strong>PDF to CSV prompt helper</strong><textarea readOnly rows={7} value={csvPrompt} /><button type="button" onClick={() => { void navigator.clipboard.writeText(csvPrompt).then(() => notify("Prompt copied.")); }}>Copy prompt</button></div>
          </> : <>
            <div className="admin-question-mode"><button type="button" aria-pressed={singleQuestion.questionType === "MCQ"} onClick={() => setSingleQuestion({ ...singleQuestion, questionType: "MCQ", correctAnswer: ["A", "B", "C", "D"].includes(singleQuestion.correctAnswer) ? singleQuestion.correctAnswer : "A" })}>MCQ</button><button type="button" aria-pressed={singleQuestion.questionType === "FBQ"} onClick={() => setSingleQuestion({ ...singleQuestion, questionType: "FBQ" })}>FBQ</button></div>
            <label className="admin-single-question">Question<textarea required rows={3} value={singleQuestion.question} onChange={(event) => setSingleQuestion({ ...singleQuestion, question: event.target.value })} /></label>
            {singleQuestion.questionType === "MCQ" ? <>{(["A", "B", "C", "D"] as const).map((letter) => <label key={letter}>Option {letter}<input required value={singleQuestion[`option${letter}`]} onChange={(event) => setSingleQuestion({ ...singleQuestion, [`option${letter}`]: event.target.value })} /></label>)}<label>Correct option<select required value={singleQuestion.correctAnswer} onChange={(event) => setSingleQuestion({ ...singleQuestion, correctAnswer: event.target.value })}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label></> : <label>Correct answer<input required value={singleQuestion.correctAnswer} onChange={(event) => setSingleQuestion({ ...singleQuestion, correctAnswer: event.target.value })} placeholder="Exact missing word or phrase" /></label>}
            <label>Explanation<input value={singleQuestion.explanation} onChange={(event) => setSingleQuestion({ ...singleQuestion, explanation: event.target.value })} /></label>
          </>}
          <button type="submit" disabled={saving}>{saving ? "Importing…" : `Import question${questionMode === "single" ? "" : "s"}`}</button>
        </form>}
        <div className="admin-course-list">{banks.map((bank, index) => <article className="admin-course-row" key={bank.id}><div className="admin-course-row-main"><strong>{index + 1}. {bank.year}</strong><small>{bank.questionCount} questions</small></div><button className="admin-icon-button admin-delete-button" aria-label={`Delete ${bank.year} question bank`} title="Delete question bank" onClick={() => void deleteBank(bank)}><TrashIcon/></button></article>)}{!banks.length && <div className="admin-empty">No question banks added yet.</div>}</div>
      </>}
    </>}
    {dialog && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title"><button className="admin-modal-close" aria-label="Close dialog" onClick={() => setDialog(null)}>×</button>
      {dialog.mode === "view" ? <><h2 id="admin-modal-title">{dialog.unit?.title}</h2><div className="admin-unit-content">{dialog.unit?.content}</div><button className="admin-modal-submit" onClick={() => setDialog(null)}>Close</button></> : section === "summaries" && selectedModule ? <form onSubmit={saveUnit}><h2 id="admin-modal-title">{dialog.mode === "edit" ? "Edit unit" : "Add unit"}</h2><label>Unit Title<input required maxLength={180} value={unitForm.title} onChange={(event) => setUnitForm({ ...unitForm, title: event.target.value })} /></label><label>Unit Contents<textarea required rows={10} value={unitForm.content} onChange={(event) => setUnitForm({ ...unitForm, content: event.target.value })} /></label><button className="admin-modal-submit" type="submit">Save Unit</button></form> : <form onSubmit={createModule}><h2 id="admin-modal-title">Add module</h2><label>Module title<input required maxLength={160} autoFocus value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} placeholder="e.g. Introduction to Business" /></label><button className="admin-modal-submit" type="submit">Save Module</button></form>}
    </section></div>}
    </fieldset>
  </section>;
}
