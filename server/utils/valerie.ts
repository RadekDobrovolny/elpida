import { clampStep, normalizeQuiz, type CourseDto, type QuizQuestion } from "~/server/utils/course";
import { stepLabel } from "~/server/utils/step-settings";

interface ValerieContext {
  userMessage: string;
  step: number;
  course: CourseDto;
}

export interface ValerieReplyResult {
  text: string;
  source: "gemini" | "fallback";
  reason?: string;
  model: string;
}

export interface ValeriePrefillResult {
  source: "gemini" | "fallback";
  reason?: string;
  model: string;
  text?: string;
  quiz?: QuizQuestion[];
}

export interface ValerieStepEvaluationResult {
  source: "gemini" | "fallback";
  reason?: string;
  model: string;
  score: number;
  feedback: string;
}

interface ValeriePrefillContext {
  step: number;
  course: CourseDto;
}

interface ValerieStepEvaluationContext {
  step: number;
  course: CourseDto;
  stepGoal: string;
  completionCriteria: string;
  stepFormContent: string;
}

function resolveGeminiConfig() {
  const config = useRuntimeConfig();
  const runtimeKey = typeof config.geminiApiKey === "string" ? config.geminiApiKey : "";
  const envKey = process.env.NUXT_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const apiKey = (runtimeKey || envKey).trim();

  const runtimeModel = typeof config.geminiModel === "string" ? config.geminiModel : "";
  const envModel = process.env.NUXT_GEMINI_MODEL || process.env.GEMINI_MODEL || "";
  const model = (runtimeModel || envModel || "gemini-3.1-flash-lite-preview").trim();

  return { apiKey, model };
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number") {
    return statusCode;
  }
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") {
    return status;
  }
  const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
  return typeof responseStatus === "number" ? responseStatus : null;
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/(key=)[^"&\s]+/gi, "$1***");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stepPrompt(step: number): string {
  switch (clampStep(step)) {
    case 1:
      return "Pomoz uživateli vyjasnit konkrétní oblast kurzu.";
    case 2:
      return "Pomoz uživateli popsat měřitelný cíl kurzu.";
    case 3:
      return "Pomoz uživateli vybrat relevantní zkušenosti, které chce předat.";
    case 4:
      return "Pomoz uživateli vytvořit 3 testové otázky se 3 možnostmi a 1 správnou odpovědí.";
    case 5:
      return "Pomoz uživateli navrhnout krátký, jasný a přitažlivý název kurzu.";
  }
}

function fallbackReply(context: ValerieContext): string {
  const step = clampStep(context.step);

  if (step === 4) {
    return "Skvělé, u kvízu potřebujeme 3 otázky. Každá otázka má mít 3 možnosti (A, B, C) a jednu správnou odpověď. Napiš je postupně a já ti je zkontroluji.";
  }
  if (step === 5) {
    return "Tohle je dobrý základ pro název. Zkus ho ještě zkrátit tak, aby bylo hned jasné, co se člověk naučí. Nabídnu ti pak 2 až 3 varianty ke srovnání.";
  }
  return "Výborně, tohle dává smysl. Zkus to ještě upřesnit jednou konkrétní větou, aby bylo jasné, komu je kurz určený a jaký má praktický přínos.";
}

function buildPrompt(context: ValerieContext): string {
  const currentQuiz = context.course.quiz
    .map((item, idx) => `${idx + 1}. ${item.question} [A:${item.options[0]} | B:${item.options[1]} | C:${item.options[2]}]`)
    .join("\n");

  return `
Jsi Valérie, žena kolem 60 let, milá a podporující. Tykáš, mluvíš jednoduše česky.

Pravidla:
- odpověď 2 až 4 krátké věty
- nepíšeš celý obsah kurzu za uživatele
- jsi facilitátor, kladeš 1 konkrétní navazující otázku
- styl: klidný, praktický, srozumitelný

Aktuální krok:
${stepPrompt(context.step)}

Data kurzu:
- Oblast: ${context.course.domain.final || context.course.domain.raw || "(zatím prázdné)"}
- Cíl: ${context.course.goal.final || context.course.goal.raw || "(zatím prázdné)"}
- Zkušenosti: ${context.course.experience.final || context.course.experience.raw || "(zatím prázdné)"}
- Kvíz: ${currentQuiz || "(zatím prázdný)"}
- Název: ${context.course.title.final || context.course.title.raw || "(zatím prázdný)"}

Nová zpráva uživatele:
"${context.userMessage}"

Napiš pouze odpověď Valérie bez odrážek.
`.trim();
}

function buildConversationTranscript(course: CourseDto): string {
  const messages = (course.messages ?? []).slice(-40);
  if (!messages.length) {
    return "(bez předchozí komunikace)";
  }

  return messages
    .map((message) => {
      const role = message.role === "assistant" ? "Valérie" : "Uživatel";
      return `${role}: ${message.content}`;
    })
    .join("\n");
}

function buildPrefillPrompt(context: ValeriePrefillContext): string {
  const step = clampStep(context.step);
  const transcript = buildConversationTranscript(context.course);

  if (step === 4) {
    return `
Z předchozí komunikace vyplň podklady pro kvíz.

Vrátíš POUZE JSON objekt ve tvaru:
{"quiz":[{"question":"...","options":["...","...","..."],"correctIndex":0}]}

Pravidla:
- vrať 1 až 3 otázky
- každá otázka má přesně 3 možnosti
- correctIndex je číslo 0, 1 nebo 2
- bez markdownu, bez komentářů, bez dalšího textu

Komunikace:
${transcript}
`.trim();
  }

  const fieldLabel =
    step === 1
      ? "Oblast kurzu"
      : step === 2
        ? "Cíl kurzu"
        : step === 3
          ? "Zkušenosti"
          : "Název kurzu";

  return `
Z předchozí komunikace vyber nejlepší stručnou hodnotu pro pole "${fieldLabel}".

Vrátíš POUZE JSON objekt ve tvaru:
{"value":"..."}

Pravidla:
- bez markdownu, bez komentářů, bez dalšího textu
- hodnota má být konkrétní a srozumitelná

Komunikace:
${transcript}
`.trim();
}

function buildStepEvaluationPrompt(context: ValerieStepEvaluationContext): string {
  const step = clampStep(context.step);
  const configuredGoal = context.stepGoal.trim();
  const configuredCriteria = context.completionCriteria.trim();
  const fallbackGoal = stepPrompt(step);

  return `
Jsi Valérie. Hodnotíš kvalitu vyplnění jednoho kroku formuláře kurzu.

Krok:
- číslo: ${step}
- název: ${stepLabel(step)}

Cíl kroku (z nastavení):
${configuredGoal || fallbackGoal}

Kritéria splnění kroku (z nastavení):
${configuredCriteria || "(není vyplněno, použij rozumná implicitní kritéria pro tento krok)"}

Aktuální obsah formuláře:
${context.stepFormContent || "(prázdné)"}

Vrátíš POUZE JSON objekt:
{"score":0-100,"feedback":"stručné praktické doporučení v češtině"}

Pravidla:
- score je celé číslo 0 až 100
- pokud je score < 90, feedback musí jasně říct co chybí a jak to doplnit
- pokud je score >= 90, feedback krátce potvrď a napiš 1 drobné doporučení navíc
- bez markdownu, bez komentářů, bez dalšího textu
`.trim();
}

function parseJsonFromModelOutput(rawText: string): unknown | null {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!stripped) {
    return null;
  }

  try {
    return JSON.parse(stripped);
  } catch {
    // continue
  }

  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // continue
    }
  }

  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continue
    }
  }

  return null;
}

function fallbackPrefillForStep(context: ValeriePrefillContext): { text?: string; quiz?: QuizQuestion[] } {
  const step = clampStep(context.step);

  if (step === 1) {
    return { text: context.course.domain.final || context.course.domain.raw || "" };
  }
  if (step === 2) {
    return { text: context.course.goal.final || context.course.goal.raw || "" };
  }
  if (step === 3) {
    return { text: context.course.experience.final || context.course.experience.raw || "" };
  }
  if (step === 4) {
    return { quiz: normalizeQuiz(context.course.quiz) };
  }
  return { text: context.course.title.final || context.course.title.raw || "" };
}

function fallbackStepEvaluation(context: ValerieStepEvaluationContext): ValerieStepEvaluationResult {
  const { model } = resolveGeminiConfig();
  const step = clampStep(context.step);
  const text = context.stepFormContent.trim();

  if (!text) {
    return {
      source: "fallback",
      reason: "empty_input",
      model,
      score: 0,
      feedback: "Formulář je zatím prázdný. Doplň prosím konkrétní obsah podle cíle kroku."
    };
  }

  if (step === 4) {
    const completeRows = context.course.quiz.filter((row) => {
      return row.question.trim() && row.options.every((option) => option.trim());
    });
    const score = completeRows.length >= 3 ? 94 : completeRows.length === 2 ? 75 : 55;

    if (score >= 90) {
      return {
        source: "fallback",
        reason: "gemini_unavailable",
        model,
        score,
        feedback: "Kvíz vypadá dobře. Ještě si zkontroluj, že otázky jsou jednoznačné a odpovědi věcně správné."
      };
    }

    return {
      source: "fallback",
      reason: "gemini_unavailable",
      model,
      score,
      feedback: "Pro tento krok potřebujeme 3 kompletní otázky. Každá má mít 3 možnosti a jasně určenou správnou odpověď."
    };
  }

  const textLength = text.length;
  const score = textLength >= 120 ? 94 : textLength >= 70 ? 88 : textLength >= 40 ? 78 : 60;

  if (score >= 90) {
    return {
      source: "fallback",
      reason: "gemini_unavailable",
      model,
      score,
      feedback: "Obsah je dostatečně konkrétní. Ještě zvaž, jestli ho můžeš jednou větou zpřesnit."
    };
  }

  return {
    source: "fallback",
    reason: "gemini_unavailable",
    model,
    score,
    feedback: "Obsah je dobrý základ, ale zatím není dost konkrétní. Doplň prosím přesnější a měřitelnější formulace."
  };
}

function normalizeEvaluationScore(value: unknown): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

async function askGemini(prompt: string): Promise<{ text: string | null; reason?: string }> {
  const { apiKey, model } = resolveGeminiConfig();
  if (!apiKey) {
    return { text: null, reason: "missing_api_key" };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const retryDelaysMs = [700, 1700];

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await $fetch<{
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      }>(endpoint, {
        method: "POST",
        query: { key: apiKey },
        body: {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 512
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((part) => part.text?.trim() || "")
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) {
        return { text };
      }

      console.warn("[valerie] Gemini returned empty response", { model });
      return { text: null, reason: "empty_response" };
    } catch (error) {
      const status = getErrorStatus(error);
      const isRateLimited = status === 429;
      const isRetriable = isRateLimited || status === 500 || status === 503;

      if (isRetriable && attempt < retryDelaysMs.length) {
        await sleep(retryDelaysMs[attempt]);
        continue;
      }

      console.warn("[valerie] Gemini request failed", {
        model,
        status,
        attempt: attempt + 1,
        error: sanitizeErrorMessage(error)
      });

      if (isRateLimited) {
        return { text: null, reason: "rate_limited" };
      }
      return { text: null, reason: "gemini_unavailable" };
    }
  }

  return { text: null, reason: "gemini_unavailable" };
}

export async function generateValerieReply(context: ValerieContext): Promise<ValerieReplyResult> {
  const { model } = resolveGeminiConfig();
  const aiResult = await askGemini(buildPrompt(context));
  if (!aiResult.text) {
    return {
      text: fallbackReply(context),
      source: "fallback",
      reason: aiResult.reason || "gemini_unavailable",
      model
    };
  }
  return {
    text: aiResult.text,
    source: "gemini",
    model
  };
}

export async function generateValeriePrefill(context: ValeriePrefillContext): Promise<ValeriePrefillResult> {
  const { model } = resolveGeminiConfig();
  const step = clampStep(context.step);
  const aiResult = await askGemini(buildPrefillPrompt(context));

  if (!aiResult.text) {
    return {
      ...fallbackPrefillForStep(context),
      source: "fallback",
      reason: aiResult.reason || "gemini_unavailable",
      model
    };
  }

  const parsed = parseJsonFromModelOutput(aiResult.text);

  if (step === 4) {
    const candidateQuiz =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { quiz?: unknown }).quiz)
          ? (parsed as { quiz: unknown[] }).quiz
          : [];

    const normalizedQuiz = normalizeQuiz(candidateQuiz);
    if (normalizedQuiz.length) {
      return {
        source: "gemini",
        model,
        quiz: normalizedQuiz
      };
    }

    return {
      ...fallbackPrefillForStep(context),
      source: "fallback",
      reason: "invalid_output",
      model
    };
  }

  const valueFromJson =
    parsed && typeof parsed === "object" && typeof (parsed as { value?: unknown }).value === "string"
      ? (parsed as { value: string }).value.trim()
      : "";

  const value = valueFromJson || aiResult.text.trim();
  if (value) {
    return {
      source: "gemini",
      model,
      text: value
    };
  }

  return {
    ...fallbackPrefillForStep(context),
    source: "fallback",
    reason: "invalid_output",
    model
  };
}

export async function generateValerieStepEvaluation(
  context: ValerieStepEvaluationContext
): Promise<ValerieStepEvaluationResult> {
  const { model } = resolveGeminiConfig();
  const aiResult = await askGemini(buildStepEvaluationPrompt(context));
  if (!aiResult.text) {
    return {
      ...fallbackStepEvaluation(context),
      reason: aiResult.reason || "gemini_unavailable",
      model
    };
  }

  const parsed = parseJsonFromModelOutput(aiResult.text);
  const score =
    parsed && typeof parsed === "object"
      ? normalizeEvaluationScore((parsed as { score?: unknown }).score)
      : 0;
  const feedback =
    parsed && typeof parsed === "object" && typeof (parsed as { feedback?: unknown }).feedback === "string"
      ? (parsed as { feedback: string }).feedback.trim()
      : aiResult.text.trim();

  if (!feedback) {
    return {
      ...fallbackStepEvaluation(context),
      reason: "invalid_output",
      model
    };
  }

  return {
    source: "gemini",
    model,
    score,
    feedback
  };
}
