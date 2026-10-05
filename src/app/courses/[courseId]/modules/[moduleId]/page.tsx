import Link from "next/link";
import { connectToDatabase } from "@/db";
import { Course, Module, Summary, objectIdOrNull, withId } from "@/db/models";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;

  const courseObjectId = objectIdOrNull(courseId);
  const moduleObjectId = objectIdOrNull(moduleId);

  if (!courseObjectId || !moduleObjectId) {
    return <div>Module not found.</div>;
  }

  await connectToDatabase();

  const [course, moduleDoc] = await Promise.all([
    Course.findById(courseObjectId).lean(),
    Module.findOne({ _id: moduleObjectId, courseId: courseObjectId }).lean(),
  ]);

  if (!course || !moduleDoc) {
    return <div>Module not found.</div>;
  }

  const units = await Summary.find({ moduleId: moduleDoc._id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const moduleNumber = Number(moduleDoc.position ?? 0) + 1;

  return (
    <div className="public-course-detail">
      <nav className="public-nav container">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span>NounStudyHub</span>
        </Link>
        <Link className="button button-secondary" href={`/courses/${courseId}`}>
          Course
        </Link>
      </nav>

      <main className="container">
        <div className="course-detail">
          <Link className="back-link" href={`/courses/${courseId}`}>
            <span aria-hidden="true">←</span> Back to course
          </Link>

          <div className="course-detail-grid">
            <main className="detail-main course-detail-main">
              <section className="course-header-card">
                <div className="course-header-code">
                  <span className="course-code">{course.code}</span>
                </div>

                <h1>{moduleDoc.title}</h1>

                <div className="course-header-metrics">
                  <span>{units.length} {units.length === 1 ? "unit" : "units"}</span>
                  <span>{course.title}</span>
                </div>
              </section>

              <section className="course-detail-card">
                <div className="course-section-heading">
                  <div>
                    <h2>{String(moduleNumber).padStart(2, "0")} — {moduleDoc.title}</h2>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {units.length ? (
                    units.map((unit, index) => {
                      const unitData = withId(unit);

                      return (
                        <Link
                          key={unitData.id}
                          href={`/courses/${courseId}/modules/${moduleId}/units/${unitData.id}`}
                          style={{
                            display: "block",
                            padding: "16px 18px",
                            borderRadius: 12,
                            border: "1px solid #dfe7e1",
                            background: "#f8faf8",
                            color: "#1c2a2b",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {index + 1}. {unitData.title}
                        </Link>
                      );
                    })
                  ) : (
                    <div style={{ padding: "16px", color: "#666" }}>No units available in this module yet.</div>
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