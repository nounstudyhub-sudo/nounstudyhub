"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CourseDetailsView from "../course-details-view";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();

  return (
    <div className="public-course-detail">
      <nav className="public-nav container">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>NounStudyHub</span>
        </Link>
        <Link className="button button-secondary" href="/courses">
          All courses
        </Link>
      </nav>

      <main className="container">
        <CourseDetailsView
          courseId={courseId}
          onStartMock={() => router.push("/")}
          onAskAi={() => router.push("/")}
        />
      </main>
    </div>
  );
}