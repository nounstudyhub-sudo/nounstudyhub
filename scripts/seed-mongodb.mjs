import "dotenv/config";
import mongoose, { Schema } from "mongoose";
import { randomBytes, scryptSync } from "node:crypto";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required to seed the database.");
const databaseName = process.env.MONGODB_DB?.trim() || new URL(uri).pathname.replace(/^\/+/, "") || "test";

const Course = mongoose.models.Course || mongoose.model("Course", new Schema({ code: String, title: String, description: String, createdAt: Date }, { versionKey: false }), "courses");
const QuestionBank = mongoose.models.QuestionBank || mongoose.model("QuestionBank", new Schema({ courseId: Schema.Types.ObjectId, year: Number, createdAt: Date }, { versionKey: false }), "questionBanks");
const Question = mongoose.models.Question || mongoose.model("Question", new Schema({ courseId: Schema.Types.ObjectId, bankId: Schema.Types.ObjectId, question: String, questionType: { type: String, enum: ["MCQ", "FBQ"], default: "MCQ" }, optionA: { type: String, default: null }, optionB: { type: String, default: null }, optionC: { type: String, default: null }, optionD: { type: String, default: null }, correctAnswer: String, explanation: String, createdAt: Date }, { versionKey: false }), "questions");
const User = mongoose.models.User || mongoose.model("User", new Schema({ username: String, passwordHash: String, matriculationNumber: String, role: String, isActive: Boolean, createdAt: Date }, { versionKey: false }), "users");
const MockAttempt = mongoose.models.MockAttempt || mongoose.model("MockAttempt", new Schema({ userId: Schema.Types.ObjectId, courseId: Schema.Types.ObjectId, totalQuestions: Number, correctAnswers: Number, unanswered: Number, percentage: Number, timeLimit: Number, timeUsed: Number, startedAt: Date, submittedAt: Date }, { versionKey: false }), "mockAttempts");

const courses = [
  { code: "ECO231", title: "Micro Economic Theory I", description: "Choice, markets, and the forces that shape economic decisions.", topic: "economics" },
  { code: "ECO205", title: "Macro Economic Theory I", description: "National income, inflation, unemployment and growth.", topic: "macroeconomics" },
  { code: "ACC203", title: "Financial Accounting II", description: "Financial reporting, company accounts and the language of business.", topic: "accounting" },
  { code: "ACC205", title: "Cost and Management Accounting", description: "Costing methods, budgeting and managerial decisions.", topic: "cost accounting" },
  { code: "BUS207", title: "Business Communication", description: "Communication skills that help ideas travel in organisations.", topic: "business communication" },
  { code: "BFN209", title: "Introduction to Banking", description: "Banking systems, institutions and the financial landscape.", topic: "banking" },
  { code: "GST201", title: "Nigerian Peoples and Culture", description: "The histories, cultures and communities that make Nigeria.", topic: "Nigerian culture" },
  { code: "MTH101", title: "Elementary Mathematics", description: "Fundamentals for solving quantitative problems with confidence.", topic: "mathematics" },
];
const students = [
  { username: "amaka", matric: "Nou100000001", average: 91, courses: 8 },
  { username: "tobi", matric: "Nou100000002", average: 87, courses: 8 },
  { username: "daniel", matric: "Nou100000003", average: 84, courses: 8 },
  { username: "mary", matric: "Nou100000004", average: 80, courses: 7 },
  { username: "chisom", matric: "Nou100000005", average: 77, courses: 7 },
  { username: "ibrahim", matric: "Nou100000006", average: 74, courses: 6 },
  { username: "fatima", matric: "Nou100000007", average: 70, courses: 6 },
  { username: "emeka", matric: "Nou100000008", average: 66, courses: 5 },
];
const years = [2023, 2024, 2025, 2026];
const letters = ["A", "B", "C", "D"];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  await mongoose.connect(uri, { dbName: databaseName });
  const courseIds = new Map();

  for (const item of courses) {
    const course = await Course.findOneAndUpdate(
      { code: item.code },
      { $set: { title: item.title, description: item.description }, $setOnInsert: { code: item.code } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    courseIds.set(item.code, course._id);

    for (const [yearIndex, year] of years.entries()) {
      const bank = await QuestionBank.findOneAndUpdate(
        { courseId: course._id, year },
        { $setOnInsert: { courseId: course._id, year } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (await Question.exists({ bankId: bank._id })) continue;
      const questions = Array.from({ length: 10 }, (_, index) => {
        const position = yearIndex * 10 + index + 1;
        const correct = letters[position % letters.length];
        return {
          courseId: course._id,
          bankId: bank._id,
          question: `Which of the following best describes a core principle of ${item.topic}? (${item.code} Q${position})`,
          questionType: "MCQ",
          optionA: "A principle unrelated to the subject",
          optionB: "A widely accepted principle within the subject",
          optionC: "A principle that only applies to agriculture",
          optionD: "A principle rejected by all scholars",
          correctAnswer: correct,
          explanation: `Option ${correct} accurately reflects an established principle of ${item.topic}.`,
        };
      });
      await Question.insertMany(questions);
    }
  }

  for (const student of students) {
    const user = await User.findOneAndUpdate(
      { username: student.username },
      { $set: { passwordHash: hashPassword(randomBytes(32).toString("hex")) }, $setOnInsert: { username: student.username, matriculationNumber: student.matric.toUpperCase(), role: "student", isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (await MockAttempt.exists({ userId: user._id })) continue;
    const attemptRows = [];
    for (let index = 0; index < student.courses; index += 1) {
      const course = courses[index];
      const totalQuestions = 20;
      const percentage = Math.max(30, Math.min(100, student.average + ((index * 7) % 11) - 5));
      const correctAnswers = Math.round((percentage / 100) * totalQuestions);
      const startedAt = new Date(Date.now() - (1 + ((index * 3) % 25)) * 86400000);
      attemptRows.push({ userId: user._id, courseId: courseIds.get(course.code), totalQuestions, correctAnswers, unanswered: totalQuestions - correctAnswers, percentage, timeLimit: 30, timeUsed: 1200, startedAt, submittedAt: new Date(startedAt.getTime() + 20 * 60000) });
    }
    await MockAttempt.insertMany(attemptRows);
  }

  const [courseCount, questionCount, studentCount, attemptCount] = await Promise.all([
    Course.countDocuments(), Question.countDocuments(), User.countDocuments({ role: "student" }), MockAttempt.countDocuments(),
  ]);
  console.log("Seed complete:", { courses: courseCount, questions: questionCount, students: studentCount, attempts: attemptCount });
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
