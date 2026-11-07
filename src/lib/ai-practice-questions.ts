export type AiPracticeMode = "MCQ" | "FBQ" | "MIXED";
export type GeneratedPracticeQuestion = {
  questionType: "MCQ" | "TF";
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correctAnswer: string;
  explanation: string;
};
export type AiPracticeQuestion = Omit<GeneratedPracticeQuestion, "questionType"> & {
  questionType: "MCQ" | "FBQ" | "TF";
};

function asFillInBlank(question: GeneratedPracticeQuestion): AiPracticeQuestion {
  const correctAnswer = question.options[question.correctAnswer as keyof typeof question.options];
  const answerPattern = new RegExp(correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    ...question,
    questionType: "FBQ",
    question: answerPattern.test(question.question)
      ? question.question.replace(answerPattern, "_____")
      : `${question.question}\n\nAnswer: _____`,
    correctAnswer,
    options: { A: "", B: "", C: "", D: "" },
  };
}

export function prepareAiPracticeQuestions(
  questions: GeneratedPracticeQuestion[],
  mode: AiPracticeMode,
  count: number,
): AiPracticeQuestion[] {
  const fillInBlankCount = Math.round(count * 0.2);
  let convertedMcqs = 0;
  return questions.map((question) => {
    if (question.questionType !== "MCQ") return question;
    convertedMcqs += 1;
    if (mode === "FBQ" || (mode === "MIXED" && convertedMcqs <= fillInBlankCount)) {
      return asFillInBlank(question);
    }
    return question;
  });
}
