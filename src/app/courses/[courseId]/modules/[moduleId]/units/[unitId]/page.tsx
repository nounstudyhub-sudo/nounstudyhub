import Link from "next/link";
import { connectToDatabase } from "@/db";
import { Course, Module, Summary, objectIdOrNull, withId } from "@/db/models";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; unitId: string }>;
}) {
  const { courseId, moduleId, unitId } = await params;

  const courseObjectId = objectIdOrNull(courseId);
  const moduleObjectId = objectIdOrNull(moduleId);
  const unitObjectId = objectIdOrNull(unitId);

  if (!courseObjectId || !moduleObjectId || !unitObjectId) {
    return <div>Unit not found.</div>;
  }

  await connectToDatabase();

  const [course, moduleDoc, allUnits] = await Promise.all([
    Course.findById(courseObjectId).lean(),
    Module.findOne({ _id: moduleObjectId, courseId: courseObjectId }).lean(),
    Summary.find({ moduleId: moduleObjectId }).sort({ createdAt: 1, _id: 1 }).lean(),
  ]);

  if (!course || !moduleDoc) {
    return <div>Unit not found.</div>;
  }

  const unitData = allUnits.find((unit) => String(unit._id) === String(unitObjectId));
  if (!unitData) {
    return <div>Unit not found.</div>;
  }

  const safeUnit = withId(unitData);
  const unitIndex = allUnits.findIndex((unit) => String(unit._id) === String(unitObjectId));
  const previousUnit = unitIndex > 0 ? withId(allUnits[unitIndex - 1]) : null;
  const nextUnit = unitIndex < allUnits.length - 1 ? withId(allUnits[unitIndex + 1]) : null;

  return (
    <div className="public-course-detail">
      <nav className="public-nav container">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>NounStudyHub</span>
        </Link>
        <Link className="button button-secondary" href={`/courses/${courseId}/modules/${moduleId}`}>
          Module
        </Link>
      </nav>

      <main className="container">
        <div className="course-detail">
          <Link className="back-link" href={`/courses/${courseId}/modules/${moduleId}`}>
            <span aria-hidden="true">←</span> Back to module
          </Link>

          <div className="course-detail-grid">
            <main className="detail-main course-detail-main">
              <section className="course-header-card">
                <div className="course-header-code">
                  <span className="course-code">{course.code}</span>
                </div>

                <h1>{moduleDoc.title}</h1>

                <div className="course-header-metrics">
                  <span>{unitIndex + 1}. {safeUnit.title}</span>
                  <span>{course.title}</span>
                </div>
              </section>

              <section className="course-detail-card">
                <div className="course-section-heading">
                  <div>
                    <h2>{String(unitIndex + 1).padStart(2, "0")} — {safeUnit.title}</h2>
                  </div>
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    fontSize: 16,
                    color: "#23313a",
                    padding: "4px 0",
                  }}
                >
                  {safeUnit.content}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginTop: 20,
                    flexWrap: "wrap",
                  }}
                >
                  {previousUnit ? (
                    <Link
                      href={`/courses/${courseId}/modules/${moduleId}/units/${previousUnit.id}`}
                      style={{
                        textDecoration: "none",
                        color: "#1d7f63",
                        fontWeight: 700,
                        padding: "10px 14px",
                        border: "1px solid #dfe7e1",
                        borderRadius: 10,
                        background: "#f6faf7",
                      }}
                    >
                      ← Previous Unit
                    </Link>
                  ) : (
                    <span style={{ opacity: 0.5 }}>← Previous Unit</span>
                  )}

                  {nextUnit ? (
                    <Link
                      href={`/courses/${courseId}/modules/${moduleId}/units/${nextUnit.id}`}
                      style={{
                        textDecoration: "none",
                        color: "#1d7f63",
                        fontWeight: 700,
                        padding: "10px 14px",
                        border: "1px solid #dfe7e1",
                        borderRadius: 10,
                        background: "#f6faf7",
                      }}
                    >
                      Next Unit →
                    </Link>
                  ) : (
                    <span style={{ opacity: 0.5 }}>Next Unit →</span>
                  )}
                </div>
              </section>
            </main>
          </div>
        </div>
      </main>
    </div>
  );
}