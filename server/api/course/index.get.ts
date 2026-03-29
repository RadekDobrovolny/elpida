import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { courseToDto } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);

  const courses = await prisma.course.findMany({
    where: { anonymousUserId },
    orderBy: { updatedAt: "desc" }
  });

  return courses.map((course) => courseToDto(course));
});
