"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  questionCount: number;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then(async (response) => {
        if (!response.ok) throw new Error("Courses could not be loaded.");
        return response.json() as Promise<{ courses: Course[] }>;
      })
      .then((data) => setCourses(Array.isArray(data.courses) ? data.courses : []))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Courses could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCourses = [...courses]
    .sort((first, second) => first.code.localeCompare(second.code, undefined, { sensitivity: "base" }))
    .filter((course) => `${course.code} ${course.title}`.toLocaleLowerCase().includes(normalizedSearch));

  return (
    <div className="courses-page">
      <nav className="public-nav container courses-nav">
        <Link className="brand" href="/"><span className="brand-mark">N</span><span>NounStudyHub</span></Link>
        <Link className="courses-home-link" href="/">← back home</Link>
      </nav>
      <main className="container">
        <header className="courses-heading">
          <div className="eyebrow">EXPLORE COURSES</div>
          <h1>Find your next course.</h1>
          <p>Search by course code or title to check which courses are available on NounStudyHub.</p>
        </header>
        <div className="library-toolbar courses-search">
          <label className="search-field">
            <span className="icon" aria-hidden="true">⌕</span>
            <input
              aria-label="Search by course code or title"
              placeholder="Search by course code or title..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="courses-count" aria-live="polite">{filteredCourses.length} courses</span>
        </div>
        {loading ? <div className="public-course-message" role="status">Loading courses...</div> : error ? <div className="public-course-message" role="alert">{error}</div> : filteredCourses.length ? (
          <div className="public-course-grid">
            {filteredCourses.map((course) => (
              <Link className="public-course-card" key={course.id} href={`/courses/${course.id}`}>
                <span><strong>{course.code}</strong> {course.title}</span>
                <span className="icon" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="public-course-message">{search ? "No courses match that search." : "No courses are available yet."}</div>
        )}
      </main>
    </div>
  );
}