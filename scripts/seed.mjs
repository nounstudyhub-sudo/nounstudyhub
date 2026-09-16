import { Client } from "pg";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";

const client = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const COURSES = [
  { code: "ECO231", title: "Micro Economic Theory I", desc: "Choice, markets, and the forces that shape economic decisions.", topic: "economics" },
  { code: "ECO205", title: "Macro Economic Theory I", desc: "National income, inflation, unemployment and growth.", topic: "macroeconomics" },
  { code: "ACC203", title: "Financial Accounting II", desc: "Financial reporting, company accounts and the language of business.", topic: "accounting" },
  { code: "ACC205", title: "Cost and Management Accounting", desc: "Costing methods, budgeting and managerial decisions.", topic: "cost accounting" },
  { code: "BUS207", title: "Business Communication", desc: "Communication skills that help ideas travel in organisations.", topic: "business communication" },
  { code: "BFN209", title: "Introduction to Banking", desc: "Banking systems, institutions and the financial landscape.", topic: "banking" },
  { code: "GST201", title: "Nigerian Peoples and Culture", desc: "The histories, cultures and communities that make Nigeria.", topic: "Nigerian culture" },
  { code: "MTH101", title: "Elementary Mathematics", desc: "Fundamentals for solving quantitative problems with confidence.", topic: "mathematics" },
];

const YEARS = [2023, 2024, 2025, 2026];
const LETTERS = ["A", "B", "C", "D"];

function buildQuestions(topic, code) {
  const items = [];
  for (let i = 1; i <= 40; i += 1) {
    const correct = LETTERS[i % 4];
    items.push({
      question: `Which of the following best describes a core principle of ${topic}? (${code} Q${i})`,
      optionA: "A principle unrelated to the subject",
      optionB: "A widely accepted principle within the subject",
      optionC: "A principle that only applies to agriculture",
      optionD: "A principle rejected by all scholars",
      correctAnswer: correct,
      explanation: `Option ${correct} is correct because it accurately reflects the established principle of ${topic}, while the other options are either irrelevant or incorrect.`,
    });
  }
  return items;
}

const STUDENTS = [
  { username: "amaka", matric: "Nou100000001", password: "student123", avg: 91, courses: 8 },
  { username: "tobi", matric: "Nou100000002", password: "student123", avg: 87, courses: 8 },
  { username: "daniel", matric: "Nou100000003", password: "student123", avg: 84, courses: 8 },
  { username: "mary", matric: "Nou100000004", password: "student123", avg: 80, courses: 7 },
  { username: "chisom", matric: "Nou100000005", password: "student123", avg: 77, courses: 7 },
  { username: "ibrahim", matric: "Nou100000006", password: "student123", avg: 74, courses: 6 },
  { username: "fatima", matric: "Nou100000007", password: "student123", avg: 70, courses: 6 },
  { username: "emeka", matric: "Nou100000008", password: "student123", avg: 66, courses: 5 },
];

async function main() {
  await client.connect();

  // Courses
  const courseIds = {};
  for (const c of COURSES) {
    const res = await client.query(
      `INSERT INTO courses (code, title, description) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
       RETURNING id`,
      [c.code, c.title, c.desc],
    );
    courseIds[c.code] = res.rows[0].id;
  }

  // Question banks + questions
  for (const c of COURSES) {
    const courseId = courseIds[c.code];
    const items = buildQuestions(c.topic, c.code);
    for (let y = 0; y < YEARS.length; y += 1) {
      const year = YEARS[y];
      const bankRes = await client.query(
        `INSERT INTO question_banks (course_id, year) VALUES ($1,$2)
         ON CONFLICT (course_id, year) DO UPDATE SET year = EXCLUDED.year
         RETURNING id`,
        [courseId, year],
      );
      const bankId = bankRes.rows[0].id;
      const existing = await client.query("SELECT COUNT(*)::int AS n FROM questions WHERE bank_id = $1", [bankId]);
      if (existing.rows[0].n > 0) continue;
      const slice = items.slice(y * 10, y * 10 + 10);
      for (const q of slice) {
        await client.query(
          `INSERT INTO questions (course_id, bank_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [courseId, bankId, q.question, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.explanation],
        );
      }
    }
  }

  // Demo students + attempts
  for (const s of STUDENTS) {
    const userRes = await client.query(
      `INSERT INTO users (username, password_hash, matriculation_number, role, is_active)
       VALUES ($1,$2,$3,'student',true)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [s.username, hashPassword(s.password), s.matric],
    );
    const userId = userRes.rows[0].id;
    const existingAttempts = await client.query("SELECT COUNT(*)::int AS n FROM mock_attempts WHERE user_id = $1", [userId]);
    if (existingAttempts.rows[0].n > 0) continue;

    const codes = COURSES.slice(0, s.courses).map((c) => c.code);
    for (let i = 0; i < codes.length; i += 1) {
      const courseId = courseIds[codes[i]];
      const total = 20;
      const jitter = ((i * 7) % 11) - 5; // deterministic spread
      const pct = Math.max(30, Math.min(100, s.avg + jitter));
      const correct = Math.round((pct / 100) * total);
      const dayOffset = 1 + ((i * 3) % 25); // spread across the last month
      await client.query(
        `INSERT INTO mock_attempts
          (user_id, course_id, total_questions, correct_answers, unanswered, percentage, time_limit, time_used, started_at, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() - ($9 || ' days')::interval, NOW() - ($9 || ' days')::interval + interval '20 minutes')`,
        [userId, courseId, total, correct, total - correct, pct, 30, 1200, String(dayOffset)],
      );
    }
  }

  const stats = await client.query(`
    SELECT (SELECT COUNT(*) FROM courses) AS courses,
           (SELECT COUNT(*) FROM questions) AS questions,
           (SELECT COUNT(*) FROM users WHERE role='student') AS students,
           (SELECT COUNT(*) FROM mock_attempts) AS attempts
  `);
  console.log("Seed complete:", stats.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
