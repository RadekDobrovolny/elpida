import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { courseToDto } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);

  const course = await prisma.course.create({
    data: {
      anonymousUserId,
      quiz: "[]",
      currentStep: 1
    }
  });

  await prisma.chatMessage.create({
    data: {
      courseId: course.id,
      role: "assistant",
      content:
        "Ahoj, jsem Valérie. Začneme oblastí tvého kurzu. O čem přesně chceš kurz vytvořit?"
    }
  });

  const created = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return courseToDto(created!);
});
