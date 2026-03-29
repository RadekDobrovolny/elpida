<script setup lang="ts">
interface QuizQuestion {
  question: string;
  options: [string, string, string];
  correctIndex: number;
}

interface CourseListItem {
  id: string;
  domain: { raw: string; final: string };
  goal: { raw: string; final: string };
  experience: { raw: string; final: string };
  quiz: QuizQuestion[];
  title: { raw: string; final: string };
  currentStep: number;
  updatedAt: string;
}

const creating = ref(false);
const deletingCourseIds = ref<string[]>([]);
const deleteStatusMessage = ref("");
const { data: courses, pending, refresh } = await useFetch<CourseListItem[]>("/api/course", {
  default: () => []
});

async function createCourse() {
  creating.value = true;
  try {
    const created = await $fetch<{ id: string }>("/api/course", { method: "POST" });
    await navigateTo(`/courses/${created.id}`);
  } finally {
    creating.value = false;
  }
}

function labelForCourse(course: CourseListItem): string {
  return (
    course.title.final ||
    course.title.raw ||
    course.domain.final ||
    course.domain.raw ||
    "Nový kurz"
  );
}

function isDeletingCourse(courseId: string): boolean {
  return deletingCourseIds.value.includes(courseId);
}

async function deleteCourse(courseId: string) {
  if (!courses.value || isDeletingCourse(courseId)) {
    return;
  }

  const shouldDelete = globalThis.confirm("Opravdu chceš tento kurz smazat?");
  if (!shouldDelete) {
    return;
  }

  deleteStatusMessage.value = "";
  deletingCourseIds.value = [...deletingCourseIds.value, courseId];

  const previousCourses = [...courses.value];
  courses.value = courses.value.filter((course) => course.id !== courseId);

  try {
    await $fetch<{ ok: boolean; id: string }>(`/api/course/${courseId}`, {
      method: "DELETE"
    });
  } catch {
    courses.value = previousCourses;
    deleteStatusMessage.value = "Kurz se nepodařilo smazat.";
  } finally {
    deletingCourseIds.value = deletingCourseIds.value.filter((id) => id !== courseId);
    await refresh();
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-6xl bg-project-white p-4 md:p-8">
    <header class="mb-6 rounded-3xl border border-project-blue/60 bg-project-white p-6 shadow-sm">
      <div class="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-project-teal">Valérie</p>
          <h1 class="text-3xl font-semibold text-project-teal">Knihovna kurzů</h1>
          <p class="text-sm text-slate-600">Vytvoř nový návrh kurzu nebo pokračuj v rozpracovaném.</p>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
          <NuxtLink
            to="/settings"
            class="rounded-xl border border-project-teal bg-project-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-project-teal/15"
          >
            Nastavení kroků
          </NuxtLink>
          <button
            type="button"
            class="rounded-xl bg-project-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-project-teal/90"
            :disabled="creating"
            @click="createCourse"
          >
            {{ creating ? "Vytvářím..." : "Nový kurz" }}
          </button>
        </div>
      </div>
    </header>

    <div class="mb-4 flex justify-end">
      <button
        type="button"
        class="rounded-lg border border-project-teal bg-project-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-project-teal/15"
        @click="refresh"
      >
        Obnovit seznam
      </button>
    </div>

    <div v-if="deleteStatusMessage" class="mb-4 rounded-xl border border-project-red/40 bg-project-red/10 px-4 py-3 text-sm text-project-red">
      {{ deleteStatusMessage }}
    </div>

    <section v-if="pending" class="rounded-2xl border border-project-blue/50 bg-project-white p-8 text-center text-slate-600 shadow-sm">
      Načítám kurzy...
    </section>

    <section v-else-if="!courses.length" class="rounded-2xl border border-dashed border-project-lime bg-project-white p-10 text-center shadow-sm">
      <div class="space-y-3">
        <h2 class="text-xl font-semibold text-slate-900">Zatím tu nic není</h2>
        <p class="text-sm text-slate-600">Začni prvním kurzem a projdi 5 kroků s Valérií.</p>
        <button
          type="button"
          class="mt-2 rounded-xl bg-project-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-project-teal/90"
          @click="createCourse"
        >
          Začít tvořit kurz
        </button>
      </div>
    </section>

    <section v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="course in courses"
        :key="course.id"
        class="group rounded-2xl border border-project-blue/40 bg-project-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-project-teal hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-project-teal">Krok {{ course.currentStep }} / 5</p>
          <button
            type="button"
            class="rounded-lg border border-project-red/50 px-2.5 py-1 text-xs font-semibold text-project-red transition hover:bg-project-red/10 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isDeletingCourse(course.id)"
            @click="deleteCourse(course.id)"
          >
            {{ isDeletingCourse(course.id) ? "Mažu..." : "Smazat" }}
          </button>
        </div>
        <NuxtLink :to="`/courses/${course.id}`" class="mt-2 block">
          <h2 class="line-clamp-2 text-lg font-semibold text-slate-900">{{ labelForCourse(course) }}</h2>
          <p class="mt-2 line-clamp-2 text-sm text-slate-600">
            {{ course.goal.final || course.goal.raw || "Doplň cíl kurzu" }}
          </p>
          <p class="mt-4 text-xs text-slate-500">
            Upraveno: {{ new Date(course.updatedAt).toLocaleString("cs-CZ") }}
          </p>
        </NuxtLink>
      </article>
    </section>
  </main>
</template>
