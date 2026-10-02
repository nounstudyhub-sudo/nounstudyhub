"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type CourseDetail = {
  code: string;
  title: string;
  description: string;
  questionCount: number;
};

type CourseResponse = {
  course: CourseDetail;
  banks: { year: number }[];
  modules: { id: string; title: string }[];
};

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<CourseResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/courses/${encodeURIComponent(courseId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "Course not found." : "Course details could not be loaded.");
        return response.json() as Promise<CourseResponse>;
      })
      .then(setData)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Course details could not be loaded."));
  }, [courseId]);

  return (
    <div className="public-course-detail">
      <nav className="public-nav container">
        <Link className="brand" href="/"><span className="brand-mark">N</span><span>NounStudyHub</span></Link>
        <Link className="button button-secondary" href="/courses">All courses</Link>
      </nav>
      <main className="container">
        {error ? <div className="public-course-message" role="alert">{error}</div> : !data ? <div className="public-course-message" role="status">Loading course...</div> : <>
          <Link className="back-link" href="/courses">← Back to courses</Link>
          <section className="course-hero">
            <div className="course-hero-icon">{data.course.code.slice(0, 1)}</div>
            <div>
              <div className="course-code">{data.course.code}</div>
              <h1>{data.course.title}</h1>
              <p>{data.course.description}</p>
              <div className="course-detail-meta"><span>{data.course.questionCount} questions available</span><span>{data.modules.length} learning modules</span></div>
            </div>
            <Link className="button" href="/">Open study hub <span className="icon" aria-hidden="true">→</span></Link>
          </section>
          <section className="course-detail-modules">
            <h2>Course content</h2>
            {data.modules.length ? <ul>{data.modules.map((module) => <li key={module.id}>{module.title}</li>)}</ul> : <p className="public-course-message">Course modules are being prepared.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}