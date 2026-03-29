import { createError } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const courseId = getRouterParam(event, "id");

  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: "Missing course ID." });
  }

  const existing = await prisma.course.findFirst({
    where: { id: courseId, anonymousUserId },
    select: { id: true }
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Course not found." });
  }

  await prisma.course.delete({
    where: { id: courseId }
  });

  return { ok: true, id: courseId };
});
