# nounstudyhub

NounStudyHub — course summaries, mock CBT practice and progress tracking for NOUN students.

## Quick start (local)

```bash
npm install
# 1. Configure MongoDB, then create indexes and seed sample data:
npm run db:setup
# 2. Run the dev server:
npm run dev
```

Set `MONGODB_URI` in a `.env` file (see `.env.example`). For local development, use `mongodb://127.0.0.1:27017/nounstudyhub`; MongoDB Atlas connection strings use the `mongodb+srv://` format. If your URI has no database path, MongoDB's default database is `test`; set `MONGODB_DB` to select a different database explicitly.

Switching from PostgreSQL does not copy existing records. Export/import any data you need before changing database providers; `npm run db:seed` only inserts the documented demo dataset.

## Environment variables

| Variable            | Required | Purpose                                                              |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `MONGODB_URI`       | Yes      | MongoDB connection string                                             |
| `MONGODB_DB`        | No       | Database override when the URI omits `/database` (default `test`)    |
| `ADMIN_USERNAME`    | Yes      | Admin console username                                                |
| `ADMIN_PASSWORD`    | Yes      | Admin console password — plain text or bcrypt hash                    |
| `GEMINI_API_KEY`    | No       | Server-only Google Gemini key for AI routes                          |
| `AI_DAILY_LIMIT`    | No       | Authenticated user's shared daily AI request limit (default 100)    |

Set admin credentials in a private `.env` file locally and in Render's environment settings. The login route intentionally has no hard-coded fallback credentials.

## Deploying to Render

1. Create a MongoDB Atlas cluster and database user. Copy the connection string and allow your Render service to connect in Atlas Network Access.
2. Create a Web Service from your GitHub repo:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
3. Add environment variables in **Render → Your service → Environment**:
   - `MONGODB_URI` (the MongoDB connection string)
   - `MONGODB_DB` (the database containing NounStudyHub collections; required when the URI has no database path)
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - `GEMINI_API_KEY`, `AI_DAILY_LIMIT` (optional)
4. Run `npm run db:create` with the Render MongoDB environment values to create the required indexes. Mongoose creates collections when records are first written; no table migration step is required.
5. (Optional) To load demo courses and questions, run `npm run db:setup` with `MONGODB_URI` set for the target cluster.

## Database setup commands

- `npm run db:create` — create/ensure MongoDB indexes (idempotent)
- `npm run db:seed` — load demo courses, question banks, questions and students
- `npm run db:setup` — ensure indexes, then seed

## AI API foundations

The authenticated, server-only AI routes are `/api/ai/explain`, `/api/ai/chat`, `/api/ai/performance`, and `/api/ai/practice`. They share an atomic per-user UTC-day limit stored in MongoDB; unauthenticated requests are rejected before usage is read or incremented. Configure `GEMINI_API_KEY` in the server environment only. Practice suggestions are returned to the caller and are not written to the CBT question bank or mock attempts.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create an optimized production build
- `npm run start` — run the production build
- `npm run typecheck` — run the TypeScript type checker
- `npm run lint` — run ESLint

## Admin console

The admin console lives at `/admin/login`. Use credentials configured via `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
