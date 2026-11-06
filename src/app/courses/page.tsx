"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  questionCount: number;
  moduleCount: number;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/courses", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { courses?: Course[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Courses could not be loaded.");
        if (!Array.isArray(data.courses)) throw new Error("The course list response was invalid.");
        return data.courses;
      })
      .then(setCourses)
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return courses
      .filter((course) => `${course.code} ${course.title}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((first, second) => first.title.localeCompare(second.title, undefined, { sensitivity: "base" }));
  }, [courses, query]);

  return (
    <div className="landing-page guest-courses">
      <nav className="public-nav container">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>NounStudyHub</span>
        </Link>
        <div className="nav-actions">
          <Link className="button button-ghost" href="/">Home</Link>
        </div>
      </nav>

      <main className="container">
        <div className="guest-courses-banner">
          <div className="eyebrow">EXPLORE COURSES</div>
          <h2>Browse every course on NounStudyHub.</h2>
          <p>Preview the full library before you sign in. Sign up to start practising.</p>
        </div>

        <div className="library-toolbar">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search courses"
              aria-label="Search courses"
            />
          </label>
          {!loading && !error && <span>{filteredCourses.length} courses available</span>}
        </div>

        {loading ? (
          <div className="loading-state" role="status"><span className="loader" /> Loading courses…</div>
        ) : error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : filteredCourses.length ? (
          <div className="card-grid library-grid">
            {filteredCourses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-card-top">
                  <div className={`course-icon ${course.code.startsWith("ECO") ? "course-icon-blue" : course.code.startsWith("ACC") ? "course-icon-purple" : course.code.startsWith("MTH") ? "course-icon-yellow" : "course-icon-green"}`}>
                    {course.code.slice(0, 1)}
                  </div>
                </div>
                <div className="course-code">{course.code}</div>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="course-card-meta">
                  <span>{course.questionCount} questions</span>
                  <span>{course.moduleCount} modules</span>
                </div>
                <div className="course-card-actions">
                  <Link className="button button-secondary" href={`/courses/${encodeURIComponent(course.id)}`}>
                    View course <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>{query.trim() ? "No courses found" : "No courses available"}</h3>
            <p>{query.trim() ? "Try a different course code or title." : "Courses will appear here when they are available."}</p>
          </div>
        )}
      </main>
    </div>
  );
}
