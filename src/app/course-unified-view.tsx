'use client';

import { useEffect, useState } from "react";
import Link from "next/link";

type CourseData = {
  course: { id: string; code: string; title: string; description: string; questionCount: number };
  banks: { id: string; year: number; questionCount: number }[];
  modules: { id: string; title: string; units: { id: string; title: string; content: string }[] }[];
};

export function CourseUnifiedView({
  course,
  onBack,
  onMock,
}: {
  course: { id: string; code: string; title: string; description: string; questionCount: number };
  onBack: () => void;
  onMock: (year?: number, questionCount?: number) => void;
}) {
  const [data, setData] = useState<CourseData | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}`);
        if (!response.ok) throw new Error("Failed to load course data");
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [course.id]);

  if (loading) {
    return (
      <div className="course-unified-page">
        <button className="back-link" onClick={onBack}>
          ← Back to courses
        </button>
        <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
          Loading course content…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="course-unified-page">
        <button className="back-link" onClick={onBack}>
          ← Back to courses
        </button>
        <div style={{ textAlign: "center", padding: "40px 0", color: "#d32f2f" }}>
          {error || "Course not found"}
        </div>
      </div>
    );
  }

  const courseInitial = data.course.code?.[0] || "C";
  const totalQuestions = data.course.questionCount;
  const modules = data.modules;
  const banks = data.banks.filter((b) => b.questionCount > 0);

  return (
    <div className="course-unified-page">
      {/* Back Link */}
      <button className="back-link" onClick={onBack}>
        ← Back to courses
      </button>

      {/* Header Card (soft green) */}
      <div className="course-header-unified">
        <div className="course-header-icon">{courseInitial}</div>

        <div className="course-header-content">
          <span className="course-code-label">{data.course.code}</span>
          <h1 className="course-title-large">{data.course.title}</h1>
        </div>

        <div className="course-metrics-row">
          <span>{totalQuestions} questions available</span>
          <span>•</span>
          <span>{modules.length} learning modules</span>
        </div>

        <div className="course-header-actions">
          <button
            className="course-action-button past-questions"
            onClick={() => {
              const firstBank = banks[0];
              onMock?.(firstBank?.year, firstBank?.questionCount);
            }}
          >
            ↗ Past-question practice
          </button>
          <button className="course-action-button saved-pill" title="Save course">
            ♡ Saved
          </button>
        </div>
      </div>

      {/* Course Modules Card */}
      <div className="course-modules-section">
        <div className="section-header">
          <h2>Course modules</h2>
          <p>Build understanding one module at a time.</p>
        </div>

        <div className="modules-container">
          {modules.length > 0 ? (
            modules.map((module, idx) => {
              const isExpanded = expandedModuleId === module.id;

              return (
                <div key={module.id} className="module-row-unified">
                  <div className="module-row-header">
                    <span className="module-number">{String(idx + 1).padStart(2, "0")}</span>

                    <div className="module-info">
                      <h3 className="module-title">{module.title}</h3>
                      <p className="module-units-count">{module.units.length} units</p>
                    </div>

                    <div className="module-status">
                      {idx === 0 ? "In progress" : "Not started"}
                    </div>

                    <button
                      className="module-expand-toggle"
                      onClick={() => setExpandedModuleId(isExpanded ? null : module.id)}
                      aria-expanded={isExpanded}
                    >
                      ⌄
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="module-units-list">
                      {module.units.length > 0 ? (
                        module.units.map((unit, unitIdx) => (
                          <div key={unit.id} className="unit-item">
                            <span className="unit-number">{unitIdx + 1}.</span>
                            <span className="unit-title">{unit.title}</span>
                          </div>
                        ))
                      ) : (
                        <div className="unit-empty">No units available in this module.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="modules-empty">No course modules available yet.</div>
          )}
        </div>
      </div>

      {/* Ready to Test Banner */}
      <div className="course-test-banner-unified">
        <div className="banner-text">
          <p className="banner-label">READY TO TEST YOURSELF?</p>
          <h3>Put your learning into practice.</h3>
        </div>
        <button
          className="banner-button"
          onClick={() => onMock?.()}
        >
          Attempt a mock →
        </button>
      </div>

      {/* Question Banks Card */}
      <div className="question-banks-section">
        <div className="section-header">
          <h2>Question banks</h2>
          <span className="banks-count">{banks.length} {banks.length === 1 ? "year" : "years"}</span>
        </div>

        <div className="banks-list">
          {banks.length > 0 ? (
            banks.map((bank) => (
              <button
                key={bank.id}
                className="bank-row"
                onClick={() => onMock?.(bank.year, bank.questionCount)}
              >
                <span className="bank-year">{bank.year}</span>
                <span className="bank-count">{bank.questionCount} questions</span>
                <span className="bank-arrow">→</span>
              </button>
            ))
          ) : (
            <div className="banks-empty">No question banks available for this course yet.</div>
          )}
        </div>

        <button className="browse-questions-button">
          Browse questions →
        </button>
      </div>
    </div>
  );
}