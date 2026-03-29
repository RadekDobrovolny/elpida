import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { prisma } from "~/server/utils/prisma";
import { buildStepSettings } from "~/server/utils/step-settings";

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);

  const rows = await prisma.stepSetting.findMany({
    where: { anonymousUserId },
    orderBy: { step: "asc" }
  });

  return {
    steps: buildStepSettings(rows)
  };
});
