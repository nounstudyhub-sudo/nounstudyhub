import mongoose, { Schema, Types } from "mongoose";

const objectId = Schema.Types.ObjectId;
const commonOptions = { versionKey: false as const };

export interface UserRecord {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  matriculationNumber: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<UserRecord>({
  username: { type: String, required: true, trim: true, lowercase: true, minlength: 3, maxlength: 40 },
  passwordHash: { type: String, required: true },
  matriculationNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  phoneNumber: { type: String, default: null, maxlength: 30 },
  role: { type: String, required: true, default: "student", maxlength: 12 },
  isActive: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
UserSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "users_username_ci_unique" });
UserSchema.index({ matriculationNumber: 1 }, { unique: true, name: "users_matriculation_unique" });

const SessionSchema = new Schema({
  token: { type: String, required: true },
  userId: { type: objectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
SessionSchema.index({ token: 1 }, { unique: true, name: "sessions_token_unique" });
SessionSchema.index({ userId: 1 }, { name: "sessions_user" });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry_ttl" });

const CourseSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: "" },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
CourseSchema.index({ code: 1 }, { unique: true, name: "courses_code_unique" });

const ModuleSchema = new Schema({
  courseId: { type: objectId, ref: "Course", required: true, index: true },
  title: { type: String, required: true, maxlength: 160 },
  position: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const SummarySchema = new Schema({
  moduleId: { type: objectId, ref: "Module", required: true, index: true },
  title: { type: String, required: true, maxlength: 180 },
  content: { type: String, required: true },
  updatedAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const QuestionBankSchema = new Schema({
  courseId: { type: objectId, ref: "Course", required: true },
  year: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
QuestionBankSchema.index({ courseId: 1, year: 1 }, { unique: true, name: "question_banks_course_year_unique" });

const QuestionSchema = new Schema({
  courseId: { type: objectId, ref: "Course", required: true, index: true },
  bankId: { type: objectId, ref: "QuestionBank", required: true, index: true },
  question: { type: String, required: true },
  questionType: { type: String, required: true, enum: ["MCQ", "FBQ"], default: "MCQ" },
  optionA: { type: String, default: null },
  optionB: { type: String, default: null },
  optionC: { type: String, default: null },
  optionD: { type: String, default: null },
  correctAnswer: { type: String, required: true },
  explanation: { type: String, default: null },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const MockAttemptSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true, index: true },
  courseId: { type: objectId, ref: "Course", required: true, index: true },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true, default: 0 },
  unanswered: { type: Number, required: true, default: 0 },
  percentage: { type: Number, required: true, default: 0 },
  timeLimit: { type: Number, required: true },
  timeUsed: { type: Number, required: true, default: 0 },
  startedAt: { type: Date, required: true, default: Date.now },
  submittedAt: { type: Date, default: null },
}, commonOptions);

const MockAnswerSchema = new Schema({
  attemptId: { type: objectId, ref: "MockAttempt", required: true },
  questionId: { type: objectId, ref: "Question", required: true },
  position: { type: Number, required: true },
  questionType: { type: String, required: true, enum: ["MCQ", "FBQ"], default: "MCQ" },
  selectedAnswer: { type: String, default: null },
  correctAnswer: { type: String, required: true },
}, commonOptions);
MockAnswerSchema.index({ attemptId: 1, position: 1 }, { unique: true, name: "answers_attempt_position_unique" });

const FavoriteSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true },
  courseId: { type: objectId, ref: "Course", required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
FavoriteSchema.index({ userId: 1, courseId: 1 }, { unique: true, name: "favorites_user_course_unique" });

const CourseViewSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true },
  courseId: { type: objectId, ref: "Course", required: true },
  viewedAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
CourseViewSchema.index({ userId: 1, courseId: 1 }, { unique: true, name: "views_user_course_unique" });

const StudyProgressSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true },
  courseId: { type: objectId, ref: "Course", required: true },
  activeModuleId: { type: objectId, ref: "Module", default: null },
  activeUnitId: { type: objectId, ref: "Summary", default: null },
  viewedModuleIds: { type: [objectId], default: [] },
  viewedUnitIds: { type: [objectId], default: [] },
  lastStudiedAt: { type: Date, required: true, default: Date.now },
}, commonOptions);
StudyProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true, name: "study_progress_user_course_unique" });

const CourseRequestSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true, index: true },
  requestText: { type: String, required: true, maxlength: 120 },
  courseCode: { type: String, default: null, maxlength: 20 },
  courseTitle: { type: String, default: null, maxlength: 160 },
  status: { type: String, required: true, default: "Pending", maxlength: 12 },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const NotificationSchema = new Schema({
  userId: { type: objectId, ref: "User", default: null, index: true },
  type: { type: String, required: true, default: "student", maxlength: 24 },
  message: { type: String, required: true },
  link: { type: String, default: null, maxlength: 80 },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const AdminImportSchema = new Schema({
  courseId: { type: objectId, ref: "Course", required: true, index: true },
  bankId: { type: objectId, ref: "QuestionBank", required: true, index: true },
  questionCount: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, commonOptions);

const AiUsageSchema = new Schema({
  userId: { type: objectId, ref: "User", required: true },
  day: { type: String, required: true },
  count: { type: Number, required: true, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
}, commonOptions);
AiUsageSchema.index({ userId: 1, day: 1 }, { unique: true, name: "ai_usage_user_day_unique" });
AiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ai_usage_expiry_ttl" });

export const User = mongoose.models.User || mongoose.model<UserRecord>("User", UserSchema, "users");
export const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema, "sessions");
export const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema, "courses");
export const Module = mongoose.models.Module || mongoose.model("Module", ModuleSchema, "modules");
export const Summary = mongoose.models.Summary || mongoose.model("Summary", SummarySchema, "summaries");
export const QuestionBank = mongoose.models.QuestionBank || mongoose.model("QuestionBank", QuestionBankSchema, "questionBanks");
export const Question = mongoose.models.Question || mongoose.model("Question", QuestionSchema, "questions");
export const MockAttempt = mongoose.models.MockAttempt || mongoose.model("MockAttempt", MockAttemptSchema, "mockAttempts");
export const MockAnswer = mongoose.models.MockAnswer || mongoose.model("MockAnswer", MockAnswerSchema, "mockAnswers");
export const Favorite = mongoose.models.Favorite || mongoose.model("Favorite", FavoriteSchema, "favorites");
export const CourseView = mongoose.models.CourseView || mongoose.model("CourseView", CourseViewSchema, "courseViews");
export const StudyProgress = mongoose.models.StudyProgress || mongoose.model("StudyProgress", StudyProgressSchema, "studyProgress");
export const CourseRequest = mongoose.models.CourseRequest || mongoose.model("CourseRequest", CourseRequestSchema, "courseRequests");
export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema, "notifications");
export const AdminImport = mongoose.models.AdminImport || mongoose.model("AdminImport", AdminImportSchema, "adminImports");
export const AiUsage = mongoose.models.AiUsage || mongoose.model("AiUsage", AiUsageSchema, "aiUsage");

export function idString(value: unknown): string {
  return value instanceof Types.ObjectId ? value.toString() : String(value ?? "");
}

export function withId<T extends { _id: unknown }>(document: T) {
  const { _id, ...fields } = document;
  return { id: idString(_id), ...fields };
}

export function objectIdOrNull(value: unknown) {
  return Types.ObjectId.isValid(String(value ?? "")) ? new Types.ObjectId(String(value)) : null;
}
