import { createError, readBody } from "h3";
import { getAnonymousUserId } from "~/server/utils/anonymous-user";
import { clampStep } from "~/server/utils/course";
import { prisma } from "~/server/utils/prisma";
import { buildStepSettings } from "~/server/utils/step-settings";

interface SettingsBody {
  steps?: Array<{
    step?: number;
    goal?: string;
    criteria?: string;
  }>;
}

export default defineEventHandler(async (event) => {
  const anonymousUserId = getAnonymousUserId(event);
  const body = (await readBody<SettingsBody>(event)) ?? {};
  const incomingSteps = Array.isArray(body.steps) ? body.steps : [];

  const uniqueByStep = new Map<number, { goalText: string; criteriaText: string }>();
  for (const item of incomingSteps) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const step = clampStep(item.step);
    uniqueByStep.set(step, {
      goalText: typeof item.goal === "string" ? item.goal.trim() : "",
      criteriaText: typeof item.criteria === "string" ? item.criteria.trim() : ""
    });
  }

  if (uniqueByStep.size === 0) {
    throw createError({ statusCode: 400, statusMessage: "Missing settings payload." });
  }

  await prisma.$transaction(
    [...uniqueByStep.entries()].map(([step, item]) =>
      prisma.stepSetting.upsert({
        where: {
          anonymousUserId_step: {
            anonymousUserId,
            step
          }
        },
        update: {
          goalText: item.goalText,
          criteriaText: item.criteriaText
        },
        create: {
          anonymousUserId,
          step,
          goalText: item.goalText,
          criteriaText: item.criteriaText
        }
      })
    )
  );

  const rows = await prisma.stepSetting.findMany({
    where: { anonymousUserId },
    orderBy: { step: "asc" }
  });

  return {
    steps: buildStepSettings(rows)
  };
});
