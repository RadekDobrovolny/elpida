import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { clampStep, courseToDto, type CourseDto, type QuizQuestion } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";
import { generateValerieStepEvaluation } from "~/server/utils/valerie";

const PASS_THRESHOLD = 90;

interface EvaluateStepBody {
  course_id?: string;
  step?: number;
  draft?: {
    domain?: string;
    goal?: string;
    experience?: string;
    title?: string;
    quiz?: unknown;
  };
}

function draftText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDraftQuiz(input: unknown): QuizQuestion[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 3).map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const options = Array.isArray(item.options) ? item.options : [];
    const correctIndex = Number(item.correctIndex);

    return {
      question: draftText(item.question),
      options: [
        draftText(options[0]),
        draftText(options[1]),
        draftText(options[2])
      ],
      correctIndex: Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 2 ? correctIndex : 0
    };
  });
}

function buildStepFormContent(step: number, draft: EvaluateStepBody["draft"], quiz: QuizQuestion[]): string {
  const safeStep = clampStep(step);

  if (safeStep === 1) {
    return draftText(draft?.domain);
  }
  if (safeStep === 2) {
    return draftText(draft?.goal);
  }
  if (safeStep === 3) {
    return draftText(draft?.experience);
  }
  if (safeStep === 4) {
    return quiz
      .map((row, index) => {
        const options = row.options.map((option, optionIndex) => {
          const prefix = optionIndex === 0 ? "A" : optionIndex === 1 ? "B" : "C";
          return `${prefix}) ${option || "(prázdné)"}`;
        });
        const correct =
          row.correctIndex === 0 ? "A" : row.correctIndex === 1 ? "B" : "C";
        return [
          `Otázka ${index + 1}: ${row.question || "(prázdné)"}`,
          ...options,
          `Správná odpověď: ${correct}`
        ].join("\n");
      })
      .join("\n\n")
      .trim();
  }
  return draftText(draft?.title);
}

function mergeDraftIntoCourse(dto: CourseDto, step: number, draft: EvaluateStepBody["draft"], quiz: QuizQuestion[]): CourseDto {
  const safeStep = clampStep(step);
  const merged: CourseDto = {
    ...dto,
    domain: { ...dto.domain },
    goal: { ...dto.goal },
    experience: { ...dto.experience },
    title: { ...dto.title },
    quiz: [...dto.quiz]
  };

  if (safeStep === 1) {
    const value = draftText(draft?.domain);
    merged.domain.raw = value;
    merged.domain.final = value;
    return merged;
  }
  if (safeStep === 2) {
    const value = draftText(draft?.goal);
    merged.goal.raw = value;
    merged.goal.final = value;
    return merged;
  }
  if (safeStep === 3) {
    const value = draftText(draft?.experience);
    merged.experience.raw = value;
    merged.experience.final = value;
    return merged;
  }
  if (safeStep === 4) {
    merged.quiz = quiz;
    return merged;
  }

  const value = draftText(draft?.title);
  merged.title.raw = value;
  merged.title.final = value;
  return merged;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const body = (await readBody<EvaluateStepBody>(event)) ?? {};

  const courseId = body.course_id;
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing course_id." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      anonymousUserId
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200
      }
    }
  });

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: "Course not found." });
  }

  const step = clampStep(body.step ?? course.currentStep);
  const quiz = parseDraftQuiz(body.draft?.quiz);

  await prisma.chatMessage.create({
    data: {
      courseId,
      role: "system",
      content: `Aplikace odesílá vyplněný krok ${step} ke kontrole.`
    }
  });

  const setting = await prisma.stepSetting.findUnique({
    where: {
      anonymousUserId_step: {
        anonymousUserId,
        step
      }
    }
  });

  const dto = courseToDto(course);
  const courseForEvaluation = mergeDraftIntoCourse(dto, step, body.draft, quiz);
  const stepFormContent = buildStepFormContent(step, body.draft, quiz);

  const evaluation = await generateValerieStepEvaluation({
    step,
    course: courseForEvaluation,
    stepGoal: setting?.goalText || "",
    completionCriteria: setting?.criteriaText || "",
    stepFormContent
  });

  const passed = evaluation.score >= PASS_THRESHOLD;

  if (passed) {
    const refreshed = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 200
        }
      }
    });

    return {
      passed: true,
      threshold: PASS_THRESHOLD,
      score: evaluation.score,
      feedback: evaluation.feedback,
      course: refreshed ? courseToDto(refreshed) : null,
      ai: {
        source: evaluation.source,
        reason: evaluation.reason ?? null,
        model: evaluation.model
      }
    };
  }

  await prisma.chatMessage.create({
    data: {
      courseId,
      role: "assistant",
      content: `Abychom mohli pokračovat dál, je potřeba tento krok ještě doplnit.\n\n${evaluation.feedback}`
    }
  });

  const refreshed = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200
      }
    }
  });

  return {
    passed: false,
    threshold: PASS_THRESHOLD,
    score: evaluation.score,
    feedback: evaluation.feedback,
    course: refreshed ? courseToDto(refreshed) : null,
    ai: {
      source: evaluation.source,
      reason: evaluation.reason ?? null,
      model: evaluation.model
    }
  };
});
