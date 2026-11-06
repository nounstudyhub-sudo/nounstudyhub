const csvPrompt = `Convert the attached question-bank PDF into import-ready CSV. Read selectable text and visually inspect page layout, bold answer lines, and scanned pages. Use OCR for scanned pages when available; if the text or answer cannot be read reliably, mark it for review as described below. Preserve the course code, terminology, and meaning of every question. Correct only obvious OCR mistakes.

Use the bold, dark answer printed beneath each question as its source answer key. Check that answer against reliable subject knowledge; do not blindly trust the printed key. Keep it when it is correct. If it is clearly wrong and you can identify the correction with high confidence, use the verified correct answer instead. If the corrected answer is not among the supplied choices, replace the incorrect choice with it. Never guess or present an uncertain answer as verified.

Return exactly this header and column order:
question,questionType,optionA,optionB,optionC,optionD,correctAnswer,explanation

For every confidently answerable question, output one MCQ row:
- Set questionType to MCQ, including for original fill-in-the-blank questions. Preserve the blank in the question text.
- For questions that already have choices, preserve the original choices and remove only their leading labels. Generate distractors only when choices are missing or the question was fill-in-the-blank.
- Put exactly four non-empty, distinct, relevant options in optionA, optionB, optionC, and optionD. For a fill-in-the-blank, use the keyed term as the correct option and create three plausible but clearly incorrect distractors; avoid alternatives that could also be correct.
- Set correctAnswer to only the uppercase letter A, B, C, or D for the option containing the verified answer.
- Give a short explanation of why that answer is correct.
- Preserve course codes and important terminology. Keep each complete question and option in its own CSV field.

If a question or answer is unreadable, ambiguous, or cannot be verified confidently, do not guess. Still include the question if it can be read, but leave correctAnswer empty and begin explanation with "REVIEW REQUIRED:" followed by the specific uncertainty. The importer will reject that row and show its row number so it can be checked manually. Do not mark an uncertain answer as correct.

CSV rules:
- Return only CSV, with no Markdown fences, commentary, or extra columns.
- Include the exact header above, then one row per question.
- Every row must have exactly eight fields.
- Quote any field containing a comma, double quote, or line break; escape each embedded double quote by doubling it.
- Use standard CSV quoting and consistent CRLF or LF newlines.
- Do not add a question if the PDF is unreadable; return only the header so the importer reports that no questions were provided.`;

export default csvPrompt;
