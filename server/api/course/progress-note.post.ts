import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { courseToDto } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";

interface ProgressNoteBody {
  course_id?: string;
  message?: string;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const body = (await readBody<ProgressNoteBody>(event)) ?? {};

  const courseId = body.course_id;
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing course_id." });
  }

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      anonymousUserId
    }
  });

  if (!course) {
    throw createError({ statusCode: 404, statusMessage: "Course not found." });
  }

  const content = body.message?.trim() || "Krok byl úspěšně splněn. Můžeš pokračovat dál.";

  await prisma.chatMessage.create({
    data: {
      courseId,
      role: "system_success",
      content
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

  if (!refreshed) {
    throw createError({ statusCode: 404, statusMessage: "Course not found." });
  }

  return {
    course: courseToDto(refreshed)
  };
});
