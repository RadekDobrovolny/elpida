import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import {
  clampStep,
  courseToDto
} from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";
import { generateValerieReply } from "~/server/utils/valerie";

interface ChatBody {
  message?: string;
  course_id?: string;
  step?: number;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const body = (await readBody<ChatBody>(event)) ?? {};

  const message = body.message?.trim();
  const courseId = body.course_id;

  if (!message) {
    throw createError({ statusCode: 400, statusMessage: "Missing message." });
  }

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

  const activeStep = clampStep(body.step ?? course.currentStep);

  await prisma.chatMessage.create({
    data: {
      courseId,
      role: "user",
      content: message
    }
  });

  const aiResult = await generateValerieReply({
    userMessage: message,
    step: activeStep,
    course: courseToDto(course)
  });

  await prisma.chatMessage.create({
    data: {
      courseId,
      role: "assistant",
      content: aiResult.text
    }
  });

  const updatedCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200
      }
    }
  });

  const dto = courseToDto(updatedCourse!);
  const updatedStepData = {
    step: dto.currentStep,
    domain: dto.domain,
    goal: dto.goal,
    experience: dto.experience,
    quiz: dto.quiz,
    title: dto.title
  };

  return {
    response: aiResult.text,
    updated_step_data: updatedStepData,
    course: dto,
    ai: {
      source: aiResult.source,
      reason: aiResult.reason ?? null,
      model: aiResult.model
    }
  };
});
