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
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/courses")
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { courses?: Course[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Courses could not be loaded.");
        return data;
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
        <div className="public-course-search-wrap">
          <div className="library-toolbar courses-search">
            <label className="search-field">
              <span className="icon" aria-hidden="true">⌕</span>
              <input
                role="combobox"
                aria-autocomplete="list"
                aria-controls="public-course-suggestions"
                aria-expanded={searchFocused && Boolean(normalizedSearch)}
                aria-label="Search by course code or title"
                placeholder="Search by course code or title..."
                value={search}
                onFocus={() => setSearchFocused(true)}
                onChange={(event) => { setSearch(event.target.value); setSearchFocused(true); }}
                onKeyDown={(event) => { if (event.key === "Escape") setSearchFocused(false); }}
              />
            </label>
            <span className="courses-count" aria-live="polite">{filteredCourses.length} courses</span>
          </div>
          {searchFocused && normalizedSearch && <div id="public-course-suggestions" className="autocomplete public-course-suggestions" role="listbox" aria-label="Matching courses">{filteredCourses.slice(0, 8).map((course) => <Link role="option" aria-selected={false} key={course.id} href={`/courses/${course.id}`}><span><strong>{course.code}</strong><small>{course.title}</small></span><span aria-hidden="true">→</span></Link>)}{!filteredCourses.length && <div className="autocomplete-empty">No results found</div>}</div>}
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
          <div className="public-course-message">{search ? "No results found" : "No courses are available yet."}</div>
        )}
      </main>
    </div>
  );
}