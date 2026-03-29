import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import {
  clampStep,
  courseToDto,
  normalizeCourseTitle,
  normalizeFinalText,
  parseQuizInput
} from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";

interface CourseUpdateBody {
  domain?: { raw?: string; final?: string };
  goal?: { raw?: string; final?: string };
  experience?: { raw?: string; final?: string };
  quiz?: unknown;
  title?: { raw?: string; final?: string };
  currentStep?: number;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const courseId = getRouterParam(event, "id");

  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing course ID." });
  }

  const existing = await prisma.course.findFirst({
    where: { id: courseId, anonymousUserId }
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Course not found." });
  }

  const body = (await readBody<CourseUpdateBody>(event)) ?? {};
  const quiz = parseQuizInput(body.quiz);

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      domainRaw: body.domain?.raw?.trim() ?? existing.domainRaw,
      domainFinal: body.domain?.final?.trim() || normalizeFinalText(body.domain?.raw ?? existing.domainRaw),
      goalRaw: body.goal?.raw?.trim() ?? existing.goalRaw,
      goalFinal: body.goal?.final?.trim() || normalizeFinalText(body.goal?.raw ?? existing.goalRaw),
      experienceRaw: body.experience?.raw?.trim() ?? existing.experienceRaw,
      experienceFinal:
        body.experience?.final?.trim() || normalizeFinalText(body.experience?.raw ?? existing.experienceRaw),
      quiz: quiz.length ? JSON.stringify(quiz) : existing.quiz,
      titleRaw: body.title?.raw?.trim() ?? existing.titleRaw,
      titleFinal: body.title?.final?.trim() || normalizeCourseTitle(body.title?.raw ?? existing.titleRaw),
      currentStep: body.currentStep ? clampStep(body.currentStep) : existing.currentStep
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200
      }
    }
  });

  return courseToDto(updated);
});
