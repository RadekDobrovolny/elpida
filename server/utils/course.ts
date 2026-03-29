import type { ChatMessage, Course } from "@prisma/client";

export type CourseStep = 1 | 2 | 3 | 4 | 5;

export interface QuizQuestion {
  question: string;
  options: [string, string, string];
  correctIndex: number;
}

export interface CourseDto {
  id: string;
  domain: { raw: string; final: string };
  goal: { raw: string; final: string };
  experience: { raw: string; final: string };
  quiz: QuizQuestion[];
  title: { raw: string; final: string };
  currentStep: CourseStep;
  createdAt: string;
  updatedAt: string;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

export const steps = [
  { id: 1 as CourseStep, key: "domain", label: "Oblast kurzu" },
  { id: 2 as CourseStep, key: "goal", label: "Cíl kurzu" },
  { id: 3 as CourseStep, key: "experience", label: "Znalosti a zkušenosti" },
  { id: 4 as CourseStep, key: "quiz", label: "Kvíz" },
  { id: 5 as CourseStep, key: "title", label: "Název kurzu" }
];

export function clampStep(step: unknown): CourseStep {
  const parsed = Number(step);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  if (parsed <= 1) {
    return 1;
  }
  if (parsed >= 5) {
    return 5;
  }
  return parsed as CourseStep;
}

export function normalizeFinalText(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) {
    return "";
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function normalizeCourseTitle(raw: string): string {
  const value = normalizeFinalText(raw);
  if (!value) {
    return "";
  }
  return value.length > 90 ? value.slice(0, 90) : value;
}

function parseQuizQuestion(input: unknown): QuizQuestion | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Record<string, unknown>;
  const question = typeof row.question === "string" ? row.question.trim() : "";
  const options = Array.isArray(row.options) ? row.options : [];
  const normalizedOptions = options
    .map((option) => (typeof option === "string" ? option.trim() : ""))
    .filter(Boolean);
  const correctIndex = Number(row.correctIndex);

  if (!question || normalizedOptions.length !== 3) {
    return null;
  }

  const safeIndex = Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 2 ? correctIndex : 0;

  return {
    question,
    options: [
      normalizedOptions[0] ?? "",
      normalizedOptions[1] ?? "",
      normalizedOptions[2] ?? ""
    ],
    correctIndex: safeIndex
  };
}

export function normalizeQuiz(input: unknown): QuizQuestion[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map(parseQuizQuestion).filter((item): item is QuizQuestion => item !== null).slice(0, 3);
}

export function parseQuizString(raw: string): QuizQuestion[] {
  if (!raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return normalizeQuiz(parsed);
  } catch {
    return [];
  }
}

function parseQuizFromLabeledText(message: string): QuizQuestion[] {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let question = "";
  const options = ["", "", ""];
  let correctIndex = 0;

  for (const line of lines) {
    if (/^ot[aá]zka[:\-]/i.test(line)) {
      question = line.replace(/^ot[aá]zka[:\-]\s*/i, "").trim();
      continue;
    }
    if (/^(a|1)[\)\.\-:]/i.test(line)) {
      options[0] = line.replace(/^(a|1)[\)\.\-:]\s*/i, "").trim();
      continue;
    }
    if (/^(b|2)[\)\.\-:]/i.test(line)) {
      options[1] = line.replace(/^(b|2)[\)\.\-:]\s*/i, "").trim();
      continue;
    }
    if (/^(c|3)[\)\.\-:]/i.test(line)) {
      options[2] = line.replace(/^(c|3)[\)\.\-:]\s*/i, "").trim();
      continue;
    }
    if (/^spr[aá]vn[aá][\s\w]*[:\-]/i.test(line)) {
      const rawAnswer = line.replace(/^spr[aá]vn[aá][\s\w]*[:\-]\s*/i, "").trim().toLowerCase();
      if (rawAnswer.startsWith("b") || rawAnswer.startsWith("2")) {
        correctIndex = 1;
      }
      if (rawAnswer.startsWith("c") || rawAnswer.startsWith("3")) {
        correctIndex = 2;
      }
    }
  }

  if (!question || options.some((opt) => !opt)) {
    return [];
  }

  return [
    {
      question,
      options: [options[0], options[1], options[2]],
      correctIndex
    }
  ];
}

export function parseQuizInput(input: unknown): QuizQuestion[] {
  if (Array.isArray(input)) {
    return normalizeQuiz(input);
  }
  if (typeof input === "string") {
    const parsedJson = parseQuizString(input);
    if (parsedJson.length) {
      return parsedJson;
    }
    return parseQuizFromLabeledText(input);
  }
  return [];
}

export function courseToDto(course: Course & { messages?: ChatMessage[] }): CourseDto {
  return {
    id: course.id,
    domain: {
      raw: course.domainRaw,
      final: course.domainFinal
    },
    goal: {
      raw: course.goalRaw,
      final: course.goalFinal
    },
    experience: {
      raw: course.experienceRaw,
      final: course.experienceFinal
    },
    quiz: parseQuizString(course.quiz),
    title: {
      raw: course.titleRaw,
      final: course.titleFinal
    },
    currentStep: clampStep(course.currentStep),
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    messages: course.messages?.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString()
    }))
  };
}
