import { createError } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { courseToDto } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const courseId = getRouterParam(event, "id");

  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing course ID." });
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

  return courseToDto(course);
});
