import { clampStep, type CourseStep } from "~/server/utils/course";

export interface StepSettingDto {
  step: CourseStep;
  label: string;
  goal: string;
  criteria: string;
}

const STEP_LABELS: Record<CourseStep, string> = {
  1: "Oblast kurzu",
  2: "Cíl kurzu",
  3: "Zkušenosti",
  4: "Kvíz",
  5: "Název kurzu"
};

export function stepLabel(step: number): string {
  return STEP_LABELS[clampStep(step)];
}

export function buildStepSettings(
  rows: Array<{ step: number; goalText: string; criteriaText: string }>
): StepSettingDto[] {
  const byStep = new Map<number, { goalText: string; criteriaText: string }>();
  for (const row of rows) {
    byStep.set(clampStep(row.step), {
      goalText: row.goalText || "",
      criteriaText: row.criteriaText || ""
    });
  }

  return [1, 2, 3, 4, 5].map((step) => {
    const normalizedStep = clampStep(step);
    const row = byStep.get(normalizedStep);
    return {
      step: normalizedStep,
      label: STEP_LABELS[normalizedStep],
      goal: row?.goalText || "",
      criteria: row?.criteriaText || ""
    };
  });
}
