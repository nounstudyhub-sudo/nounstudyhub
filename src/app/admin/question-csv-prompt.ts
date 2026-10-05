const csvPrompt = `You are an expert data processing assistant. Convert the attached PDF question bank into a clean CSV format matching the exact structure below.

### Output Specifications & Columns:
question,questionType,optionA,optionB,optionC,optionD,correctAnswer,explanation

### Classification & Distractor Generation Rules:

1. Question Types (questionType):
   - Classify as MCQ if multiple choice options are originally present.
   - Classify as FBQ if the original question is a fill-in-the-blank question.

2. Option Generation & Distractors:
   - For MCQs: Use the original options. Strip leading labels (e.g., remove "A.", "B)", "A - ").
   - For FBQs: Convert the fill-in-the-blank question into a multiple-choice option structure. Put the correct answer into one of the options (optionA to optionD), and synthesize 3 plausible wrong options (distractors) that are relevant to the subject matter.
   - Assign optionA, optionB, optionC, or optionD for all questions (both MCQ and FBQ).

3. Correct Answer Field (correctAnswer):
   - Must contain ONLY the single uppercase letter corresponding to the correct option choice (A, B, C, or D).

4. Explanation Field (explanation):
   - Provide a concise, 1-sentence explanation confirming why the answer is correct and explaining the underlying concept.

### CSV Encoding Rules:
- Return ONLY valid CSV text starting with the header row. No markdown intros or conclusions.
- Wrap any field containing commas, quotation marks, or line breaks in double quotes (").
- Escape any double quote inside a text field with two double quotes ("").
- Ensure every row has exactly 7 commas.`;

export default csvPrompt;