import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { clampStep, courseToDto } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";
import { generateValeriePrefill } from "~/server/utils/valerie";

interface PrefillBody {
  course_id?: string;
  step?: number;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const body = (await readBody<PrefillBody>(event)) ?? {};

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

  const dto = courseToDto(course);
  const hasInteraction = (dto.messages ?? []).length > 0;
  if (!hasInteraction) {
    throw createError({ statusCode: 400, statusMessage: "No chat interaction yet." });
  }

  const step = clampStep(body.step ?? dto.currentStep);
  const prefill = await generateValeriePrefill({
    step,
    course: dto
  });

  return {
    step,
    prefill
  };
});
