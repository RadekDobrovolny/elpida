<script setup lang="ts">
interface QuizQuestion {
  question: string;
  options: [string, string, string];
  correctIndex: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  createdAt: string;
}

interface CourseDto {
  id: string;
  domain: { raw: string; final: string };
  goal: { raw: string; final: string };
  experience: { raw: string; final: string };
  quiz: QuizQuestion[];
  title: { raw: string; final: string };
  currentStep: number;
  messages?: ChatMessage[];
}

interface ChatApiResponse {
  course: CourseDto;
  ai?: {
    source?: "gemini" | "fallback" | string;
    reason?: string | null;
    model?: string | null;
  };
}

interface PrefillApiResponse {
  step: number;
  prefill: {
    source?: "gemini" | "fallback" | string;
    reason?: string | null;
    model?: string | null;
    text?: string;
    quiz?: QuizQuestion[];
  };
}

const steps = [
  { id: 1, label: "Oblast kurzu" },
  { id: 2, label: "Cíl kurzu" },
  { id: 3, label: "Zkušenosti" },
  { id: 4, label: "Kvíz" },
  { id: 5, label: "Název kurzu" }
] as const;

const route = useRoute();
const courseId = computed(() => String(route.params.id));

const { data: course, pending, error } = await useFetch<CourseDto>(`/api/course/${courseId.value}`);

const saving = ref(false);
const savingAndReturn = ref(false);
const sending = ref(false);
const fillingForm = ref(false);
const progressing = ref(false);
const chatInput = ref("");
const statusMessage = ref("");
const chatMessagesEl = ref<HTMLElement | null>(null);
const autoStepIntroSent = ref(new Set<string>());

const form = reactive({
  domain: "",
  goal: "",
  experience: "",
  quiz: [] as QuizQuestion[],
  title: "",
  currentStep: 1
});

function emptyQuizQuestion(): QuizQuestion {
  return {
    question: "",
    options: ["", "", ""],
    correctIndex: 0
  };
}

function ensureQuizSlots(quiz: QuizQuestion[]): QuizQuestion[] {
  const normalized = quiz.slice(0, 3).map((item) => ({
    question: item.question || "",
    options: [item.options?.[0] || "", item.options?.[1] || "", item.options?.[2] || ""],
    correctIndex: item.correctIndex >= 0 && item.correctIndex <= 2 ? item.correctIndex : 0
  })) as QuizQuestion[];

  while (normalized.length < 3) {
    normalized.push(emptyQuizQuestion());
  }
  return normalized;
}

function syncForm(source: CourseDto) {
  form.domain = source.domain.final || source.domain.raw || "";
  form.goal = source.goal.final || source.goal.raw || "";
  form.experience = source.experience.final || source.experience.raw || "";
  form.quiz = ensureQuizSlots(source.quiz || []);
  form.title = source.title.final || source.title.raw || "";
  form.currentStep = source.currentStep || 1;
}

watch(
  () => course.value,
  (value) => {
    if (value) {
      syncForm(value);
    }
  },
  { immediate: true }
);

const courseLabel = computed(() => {
  if (!course.value) {
    return "Kurz";
  }
  return course.value.title.final || course.value.title.raw || course.value.domain.final || course.value.domain.raw || "Nový kurz";
});

const visibleMessages = computed(() => course.value?.messages ?? []);
const currentStepLabel = computed(() => steps.find((step) => step.id === form.currentStep)?.label ?? "Krok");
const progressPercent = computed(() => Math.max(0, Math.min(100, (form.currentStep / steps.length) * 100)));
const hasChatInteraction = computed(() => visibleMessages.value.length > 0);
const canContinue = computed(() => form.currentStep < steps.length);
const isCurrentStepFilled = computed(() => {
  if (form.currentStep === 1) {
    return form.domain.trim().length > 0;
  }
  if (form.currentStep === 2) {
    return form.goal.trim().length > 0;
  }
  if (form.currentStep === 3) {
    return form.experience.trim().length > 0;
  }
  if (form.currentStep === 4) {
    return form.quiz.every((row) => {
      return row.question.trim() && row.options.every((option) => option.trim());
    });
  }
  return form.title.trim().length > 0;
});

async function scrollChatToBottom(behavior: ScrollBehavior = "auto") {
  await nextTick();
  const element = chatMessagesEl.value;
  if (!element) {
    return;
  }
  element.scrollTo({
    top: element.scrollHeight,
    behavior
  });
}

watch(
  () => visibleMessages.value.length,
  (currentLength, previousLength) => {
    if (currentLength === previousLength) {
      return;
    }
    const behavior: ScrollBehavior = previousLength === undefined ? "auto" : "smooth";
    void scrollChatToBottom(behavior);
  },
  { immediate: true }
);

function quizPayload(): QuizQuestion[] {
  return form.quiz
    .map((item) => ({
      question: item.question.trim(),
      options: [
        item.options[0].trim(),
        item.options[1].trim(),
        item.options[2].trim()
      ] as [string, string, string],
      correctIndex: item.correctIndex
    }))
    .filter((item) => item.question && item.options.every((opt) => opt));
}

async function saveCourse(options?: { successMessage?: string }): Promise<boolean> {
  if (!course.value) {
    return false;
  }

  saving.value = true;
  statusMessage.value = "";

  try {
    const updated = await $fetch<CourseDto>(`/api/course/${course.value.id}`, {
      method: "PUT",
      body: {
        domain: { raw: form.domain },
        goal: { raw: form.goal },
        experience: { raw: form.experience },
        quiz: quizPayload(),
        title: { raw: form.title },
        currentStep: form.currentStep
      }
    });
    course.value = updated;
    syncForm(updated);
    statusMessage.value = options?.successMessage ?? "Změny uloženy.";
    return true;
  } catch {
    statusMessage.value = "Uložení se nepovedlo.";
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveAndReturnToLibrary() {
  if (savingAndReturn.value || saving.value) {
    return;
  }

  savingAndReturn.value = true;
  try {
    const saved = await saveCourse({ successMessage: "Změny uloženy." });
    if (saved) {
      await navigateTo("/courses");
    }
  } finally {
    savingAndReturn.value = false;
  }
}

interface SendChatOptions {
  restoreInputOnError?: boolean;
  errorMessage?: string;
}

async function sendChatMessage(messageOverride?: string, options?: SendChatOptions): Promise<boolean> {
  if (!course.value) {
    return false;
  }
  const message = (messageOverride ?? chatInput.value).trim();
  if (!message) {
    return false;
  }

  sending.value = true;
  statusMessage.value = "";

  const shouldClearInput = typeof messageOverride !== "string";
  if (shouldClearInput) {
    chatInput.value = "";
  }

  try {
    const response = await $fetch<ChatApiResponse>("/api/chat", {
      method: "POST",
      body: {
        message,
        course_id: course.value.id,
        step: form.currentStep
      }
    });
    course.value = response.course;
    syncForm(response.course);
    if (response.ai?.source === "fallback") {
      if (response.ai.reason === "missing_api_key") {
        statusMessage.value = "AI klíč není nastavený. Odpověď je z fallbacku.";
      } else if (response.ai.reason === "rate_limited") {
        statusMessage.value = "Gemini API je dočasně limitované (429). Odpověď je z fallbacku, zkus to prosím za chvíli.";
      } else {
        statusMessage.value = `AI model (${response.ai.model || "unknown"}) nebyl dostupný. Odpověď je z fallbacku.`;
      }
    } else {
      statusMessage.value = "";
    }
    return true;
  } catch {
    if (options?.restoreInputOnError ?? shouldClearInput) {
      chatInput.value = message;
    }
    statusMessage.value = options?.errorMessage ?? "Nepodařilo se odeslat zprávu.";
    return false;
  } finally {
    sending.value = false;
  }
}

function buildStepIntroPrompt(step: number): string {
  const stepLabel = steps.find((item) => item.id === step)?.label ?? "Aktuální krok";
  return `Jsme na kroku ${step} (${stepLabel}). Stručně popiš cíl tohoto kroku a dej uživateli základní směr, jak by ho měl vyplnit.`;
}

async function sendAutomaticStepIntro(step: number) {
  if (!course.value || sending.value) {
    return;
  }

  const key = `${course.value.id}:${step}`;
  if (autoStepIntroSent.value.has(key)) {
    return;
  }

  autoStepIntroSent.value.add(key);
  const sent = await sendChatMessage(buildStepIntroPrompt(step), {
    restoreInputOnError: false,
    errorMessage: "Nepodařilo se načíst úvodní doporučení pro tento krok."
  });

  if (!sent) {
    autoStepIntroSent.value.delete(key);
  }
}

watch(
  [() => course.value?.id, () => course.value?.currentStep],
  ([id, step]) => {
    if (!id || !step) {
      return;
    }
    void sendAutomaticStepIntro(step);
  },
  { immediate: true }
);

function onChatKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }
  if (event.key !== "Enter") {
    return;
  }
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  event.preventDefault();
  if (!sending.value) {
    void sendChatMessage();
  }
}

function applyPrefillToCurrentStep(prefill: PrefillApiResponse["prefill"]): boolean {
  if (form.currentStep === 1) {
    if (!prefill.text?.trim()) {
      return false;
    }
    form.domain = prefill.text.trim();
    return true;
  }

  if (form.currentStep === 2) {
    if (!prefill.text?.trim()) {
      return false;
    }
    form.goal = prefill.text.trim();
    return true;
  }

  if (form.currentStep === 3) {
    if (!prefill.text?.trim()) {
      return false;
    }
    form.experience = prefill.text.trim();
    return true;
  }

  if (form.currentStep === 4) {
    const quiz = ensureQuizSlots(prefill.quiz ?? []);
    if (!quiz.some((row) => row.question.trim())) {
      return false;
    }
    form.quiz = quiz;
    return true;
  }

  if (!prefill.text?.trim()) {
    return false;
  }
  form.title = prefill.text.trim();
  return true;
}

async function fillFormFromChat() {
  if (!course.value || !hasChatInteraction.value || fillingForm.value) {
    return;
  }

  fillingForm.value = true;
  statusMessage.value = "";

  try {
    const response = await $fetch<PrefillApiResponse>("/api/course/prefill", {
      method: "POST",
      body: {
        course_id: course.value.id,
        step: form.currentStep
      }
    });

    const applied = applyPrefillToCurrentStep(response.prefill);
    if (!applied) {
      statusMessage.value = "Z komunikace se nepodařilo získat použitelné vyplnění pro tento krok.";
      return;
    }

    if (response.prefill.source === "fallback") {
      if (response.prefill.reason === "missing_api_key") {
        statusMessage.value = "AI klíč není nastavený. Formulář byl doplněn fallbackem.";
      } else if (response.prefill.reason === "rate_limited") {
        statusMessage.value = "Gemini API je dočasně limitované (429). Formulář byl doplněn fallbackem.";
      } else {
        statusMessage.value = `AI model (${response.prefill.model || "unknown"}) nebyl dostupný. Formulář byl doplněn fallbackem.`;
      }
      return;
    }

    statusMessage.value = "Formulář byl doplněn z předchozí komunikace.";
  } catch {
    statusMessage.value = "Automatické doplnění formuláře se nepovedlo.";
  } finally {
    fillingForm.value = false;
  }
}

async function continueToNextStep() {
  if (!canContinue.value || progressing.value) {
    return;
  }

  const previousStep = form.currentStep;
  form.currentStep = Math.min(steps.length, form.currentStep + 1);
  progressing.value = true;

  const saved = await saveCourse({
    successMessage: `Pokračuji na krok ${form.currentStep}.`
  });

  if (!saved) {
    form.currentStep = previousStep;
  }

  progressing.value = false;
}

function setStep(step: number) {
  if (step > form.currentStep) {
    return;
  }
  form.currentStep = step;
}

function panelClasses(stepId: number): string {
  if (form.currentStep === stepId) {
    return "border-project-teal bg-project-teal/15 text-slate-900";
  }
  if (form.currentStep > stepId) {
    return "border-project-blue bg-project-blue/20 text-slate-900";
  }
  return "border-project-blue/50 bg-project-white text-slate-700 hover:border-project-blue";
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-7xl bg-project-white p-4 md:p-8">
    <header class="mb-6 rounded-3xl border border-project-blue/60 bg-project-white p-5 shadow-sm">
      <NuxtLink to="/courses" class="text-sm font-medium text-project-teal hover:text-project-blue">← Knihovna kurzů</NuxtLink>
      <h1 class="mt-2 text-2xl font-semibold text-project-teal">{{ courseLabel }}</h1>
      <p class="mt-1 text-sm text-slate-600">Aktuální krok: {{ currentStepLabel }}</p>
    </header>

    <section v-if="pending" class="rounded-2xl border border-project-blue/50 bg-project-white p-8 text-center text-slate-600 shadow-sm">Načítám kurz...</section>

    <section v-else-if="error || !course" class="rounded-2xl border border-project-red/40 bg-project-red/10 p-8 text-center text-project-red shadow-sm">
      Kurz se nepodařilo načíst.
    </section>

    <section v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
      <article class="rounded-3xl border border-project-blue/50 bg-project-white p-5 shadow-sm">
        <div class="space-y-5">
          <div class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-5">
              <button
                v-for="step in steps"
                :key="step.id"
                type="button"
                class="rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                :class="panelClasses(step.id)"
                :disabled="step.id > form.currentStep"
                @click="setStep(step.id)"
              >
                <p class="text-xs font-semibold uppercase tracking-wide">Krok {{ step.id }}</p>
                <p class="mt-1 text-sm font-semibold">{{ step.label }}</p>
              </button>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-project-blue/30">
              <div class="h-full rounded-full bg-project-teal transition-all duration-300" :style="{ width: `${progressPercent}%` }" />
            </div>
          </div>

          <p class="text-sm text-slate-600">V levém panelu se zobrazuje pouze formulář pro aktuální krok.</p>

          <template v-if="form.currentStep === 1">
            <label class="grid gap-1">
              <span class="text-sm font-medium text-slate-700">Oblast kurzu</span>
              <textarea v-model="form.domain" rows="3" class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none" />
            </label>
          </template>

          <template v-else-if="form.currentStep === 2">
            <label class="grid gap-1">
              <span class="text-sm font-medium text-slate-700">Cíl kurzu</span>
              <textarea v-model="form.goal" rows="3" class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none" />
            </label>
          </template>

          <template v-else-if="form.currentStep === 3">
            <label class="grid gap-1">
              <span class="text-sm font-medium text-slate-700">Zkušenosti</span>
              <textarea v-model="form.experience" rows="3" class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none" />
            </label>
          </template>

          <template v-else-if="form.currentStep === 4">
            <div class="space-y-3">
              <h2 class="font-semibold text-slate-900">Kvíz (3 otázky)</h2>
              <div v-for="(row, index) in form.quiz" :key="index" class="rounded-xl border border-project-blue/40 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Otázka {{ index + 1 }}</p>
                <div class="mt-2 space-y-2">
                  <input v-model="row.question" type="text" placeholder="Text otázky" class="w-full rounded-lg border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none" />
                  <input v-model="row.options[0]" type="text" placeholder="A) možnost" class="w-full rounded-lg border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none" />
                  <input v-model="row.options[1]" type="text" placeholder="B) možnost" class="w-full rounded-lg border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none" />
                  <input v-model="row.options[2]" type="text" placeholder="C) možnost" class="w-full rounded-lg border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none" />
                  <label class="grid gap-1">
                    <span class="text-sm font-medium text-slate-700">Správná odpověď</span>
                    <select v-model.number="row.correctIndex" class="w-full rounded-lg border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none">
                      <option :value="0">A</option>
                      <option :value="1">B</option>
                      <option :value="2">C</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="form.currentStep === 5">
            <label class="grid gap-1">
              <span class="text-sm font-medium text-slate-700">Název kurzu</span>
              <input v-model="form.title" type="text" class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none" />
            </label>
          </template>

          <div v-if="statusMessage" class="rounded-xl border border-project-blue/40 bg-project-blue/20 px-4 py-3 text-sm text-slate-800">
            {{ statusMessage }}
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              class="rounded-xl border border-project-blue/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-project-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!hasChatInteraction || fillingForm || sending || progressing || saving || savingAndReturn"
              @click="fillFormFromChat"
            >
              {{ fillingForm ? "Doplňuji..." : "Vyplň formulář" }}
            </button>
          </div>
        </div>
      </article>

      <article class="flex h-[78vh] flex-col rounded-3xl border border-project-blue/50 bg-project-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Chat s Valérií</h2>
        <p class="mt-1 text-sm text-slate-600">Valérie odpovídá stručně a drží se aktuálního kroku.</p>

        <div ref="chatMessagesEl" class="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-project-blue/10 p-3">
          <div v-for="message in visibleMessages" :key="message.id" class="flex" :class="message.role === 'assistant' ? 'justify-start' : 'justify-end'">
            <div
              class="max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm"
              :class="message.role === 'assistant' ? 'border border-project-blue/40 bg-project-white text-slate-800' : 'bg-project-teal text-white'"
            >
              <p class="whitespace-pre-wrap">{{ message.content }}</p>
              <p class="mt-1 text-[10px]" :class="message.role === 'assistant' ? 'text-slate-400' : 'text-white/80'">
                {{ new Date(message.createdAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) }}
              </p>
            </div>
          </div>
        </div>

        <form class="mt-4 space-y-2" @submit.prevent="sendChatMessage">
          <div class="flex items-stretch gap-2">
            <textarea
              v-model="chatInput"
              rows="3"
              placeholder="Napiš zprávu pro Valérii..."
              class="h-24 flex-1 rounded-xl border border-project-blue/60 px-3 py-2 text-sm focus:border-project-teal focus:outline-none"
              @keydown="onChatKeydown"
            />
            <button
              type="submit"
              class="h-24 rounded-xl bg-project-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1ca79f] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="sending || fillingForm || progressing"
            >
              {{ sending ? "Odesílám..." : "Odeslat" }}
            </button>
          </div>

          <p class="text-xs text-slate-500">Zvolený krok: {{ form.currentStep }} / 5</p>

          <div class="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border border-project-blue/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-project-blue/15 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="saving || savingAndReturn || fillingForm || sending || progressing"
              @click="saveAndReturnToLibrary"
            >
              {{ saving || savingAndReturn ? "Ukládám..." : "Uložit a vrátit se do knihovny" }}
            </button>
            <button
              type="button"
              class="rounded-xl bg-project-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-project-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canContinue || !isCurrentStepFilled || saving || savingAndReturn || fillingForm || sending || progressing"
              @click="continueToNextStep"
            >
              {{ progressing ? "Pokračuji..." : "Pokračovat" }}
            </button>
          </div>
        </form>
      </article>
    </section>
  </main>
</template>
