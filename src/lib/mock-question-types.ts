export type MockQuestionType = "MCQ" | "FBQ" | "TF";

export type StoredMockQuestion = {
  _id: { toString(): string };
  question: string;
  questionType?: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
  explanation?: string | null;
};

export function inferMockQuestionType(question: StoredMockQuestion): MockQuestionType {
  const type = question.questionType?.toUpperCase();
  if (type === "FBQ") return "FBQ";
  if (type === "TF" || type === "TRUE_FALSE"
    || (question.optionA?.trim().toLowerCase() === "true"
      && question.optionB?.trim().toLowerCase() === "false")) return "TF";
  return "MCQ";
}

export function prepareMockQuestion(question: StoredMockQuestion, questionType: MockQuestionType) {
  const options = {
    A: question.optionA ?? null,
    B: question.optionB ?? null,
    C: question.optionC ?? null,
    D: question.optionD ?? null,
  };
  let correctAnswer = question.correctAnswer.trim();
  let questionText = question.question;

  if (questionType === "FBQ") {
    const answerLetter = correctAnswer.toUpperCase() as keyof typeof options;
    if (answerLetter in options && options[answerLetter]) {
      correctAnswer = options[answerLetter] ?? correctAnswer;
    }

    if (inferMockQuestionType(question) !== "FBQ" && correctAnswer) {
      const escapedAnswer = correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const answerPattern = new RegExp(escapedAnswer, "i");
      questionText = answerPattern.test(questionText)
        ? questionText.replace(answerPattern, "_____")
        : `${questionText}\n\nAnswer: _____`;
    }
  }

  if (questionType === "TF") {
    if (correctAnswer.toLowerCase() === options.A?.toLowerCase()) correctAnswer = "A";
    else if (correctAnswer.toLowerCase() === options.B?.toLowerCase()) correctAnswer = "B";
  }

  return {
    id: question._id.toString(),
    question: questionText,
    questionType,
    correctAnswer,
    options: questionType === "FBQ" ? undefined : options,
    snapshot: {
      question: questionText,
      questionType,
      optionA: questionType === "FBQ" ? null : options.A,
      optionB: questionType === "FBQ" ? null : options.B,
      optionC: questionType === "FBQ" ? null : options.C,
      optionD: questionType === "FBQ" ? null : options.D,
      explanation: question.explanation ?? null,
    },
  };
}
