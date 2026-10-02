import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required to create indexes.");
const databaseName = process.env.MONGODB_DB?.trim() || new URL(uri).pathname.replace(/^\/+/, "") || "test";

const indexes = {
  users: [
    [{ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "users_username_ci_unique" }],
    [{ matriculationNumber: 1 }, { unique: true, name: "users_matriculation_unique" }],
  ],
  sessions: [
    [{ token: 1 }, { unique: true, name: "sessions_token_unique" }],
    [{ userId: 1 }, { name: "sessions_user" }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry_ttl" }],
  ],
  courses: [[{ code: 1 }, { unique: true, name: "courses_code_unique" }]],
  modules: [[{ courseId: 1, position: 1 }, { name: "modules_course_position" }]],
  summaries: [[{ moduleId: 1 }, { name: "summaries_module" }]],
  questionBanks: [[{ courseId: 1, year: 1 }, { unique: true, name: "question_banks_course_year_unique" }]],
  questions: [[{ courseId: 1 }, { name: "questions_course" }], [{ bankId: 1 }, { name: "questions_bank" }]],
  mockAttempts: [[{ userId: 1, startedAt: -1 }, { name: "attempts_user_started" }], [{ courseId: 1 }, { name: "attempts_course" }]],
  mockAnswers: [[{ attemptId: 1, position: 1 }, { unique: true, name: "answers_attempt_position_unique" }]],
  favorites: [[{ userId: 1, courseId: 1 }, { unique: true, name: "favorites_user_course_unique" }]],
  courseViews: [[{ userId: 1, courseId: 1 }, { unique: true, name: "views_user_course_unique" }]],
  courseRequests: [[{ userId: 1, createdAt: -1 }, { name: "requests_user_created" }]],
  notifications: [[{ userId: 1, createdAt: -1 }, { name: "notifications_user_created" }]],
  adminImports: [[{ courseId: 1, bankId: 1 }, { name: "imports_course_bank" }]],
  aiUsage: [
    [{ userId: 1, day: 1 }, { unique: true, name: "ai_usage_user_day_unique" }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ai_usage_expiry_ttl" }],
  ],
};

try {
  await mongoose.connect(uri, { dbName: databaseName });
  for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
    const collection = mongoose.connection.collection(collectionName);
    for (const [keys, options] of collectionIndexes) {
      await collection.createIndex(keys, options);
    }
  }
  console.log("MongoDB indexes ensured.");
} finally {
  await mongoose.disconnect();
}
