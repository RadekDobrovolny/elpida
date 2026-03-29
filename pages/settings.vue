<script setup lang="ts">
interface StepSetting {
  step: number;
  label: string;
  goal: string;
  criteria: string;
}

interface SettingsResponse {
  steps: StepSetting[];
}

const saving = ref(false);
const statusMessage = ref("");
const formSteps = ref<StepSetting[]>([]);

const { data, pending, error, refresh } = await useFetch<SettingsResponse>("/api/settings", {
  default: () => ({ steps: [] })
});

watch(
  () => data.value?.steps,
  (steps) => {
    formSteps.value = (steps ?? []).map((item) => ({
      step: item.step,
      label: item.label,
      goal: item.goal || "",
      criteria: item.criteria || ""
    }));
  },
  { immediate: true }
);

async function saveSettings() {
  saving.value = true;
  statusMessage.value = "";

  try {
    const response = await $fetch<SettingsResponse>("/api/settings", {
      method: "PUT",
      body: {
        steps: formSteps.value.map((item) => ({
          step: item.step,
          goal: item.goal,
          criteria: item.criteria
        }))
      }
    });
    formSteps.value = response.steps;
    statusMessage.value = "Nastavení kroků je uloženo.";
  } catch {
    statusMessage.value = "Uložení nastavení se nepovedlo.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="mx-auto min-h-screen max-w-6xl bg-project-white p-4 md:p-8">
    <header class="mb-6 rounded-3xl border border-project-blue/60 bg-project-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-project-teal">Valérie</p>
          <h1 class="text-3xl font-semibold text-project-teal">Nastavení kroků</h1>
          <p class="text-sm text-slate-600">Definuj cíl a kritéria splnění pro jednotlivé kroky tvorby kurzu.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/courses" class="rounded-xl border border-project-teal px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-project-teal/15">
            Knihovna kurzů
          </NuxtLink>
          <NuxtLink to="/" class="rounded-xl border border-project-teal px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-project-teal/15">
            Úvod
          </NuxtLink>
        </div>
      </div>
    </header>

    <section v-if="pending" class="rounded-2xl border border-project-blue/50 bg-project-white p-8 text-center text-slate-600 shadow-sm">
      Načítám nastavení...
    </section>

    <section v-else-if="error" class="rounded-2xl border border-project-red/40 bg-project-red/10 p-8 text-center text-project-red shadow-sm">
      Nastavení se nepodařilo načíst.
    </section>

    <section v-else class="space-y-4">
      <article
        v-for="row in formSteps"
        :key="row.step"
        class="rounded-2xl border border-project-blue/40 bg-project-white p-5 shadow-sm"
      >
        <h2 class="text-lg font-semibold text-slate-900">Krok {{ row.step }}: {{ row.label }}</h2>
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <label class="grid gap-1">
            <span class="text-sm font-medium text-slate-700">Cíl kroku</span>
            <textarea
              v-model="row.goal"
              rows="4"
              placeholder="Např. Uživatel jasně definuje téma kurzu."
              class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none"
            />
          </label>

          <label class="grid gap-1">
            <span class="text-sm font-medium text-slate-700">Kritéria splnění</span>
            <textarea
              v-model="row.criteria"
              rows="4"
              placeholder="Např. Téma je konkrétní, cílová skupina je jasná, rozsah je realistický."
              class="w-full rounded-xl border border-project-blue/60 p-3 text-sm focus:border-project-teal focus:outline-none"
            />
          </label>
        </div>
      </article>

      <div v-if="statusMessage" class="rounded-xl border border-project-blue/40 bg-project-blue/20 px-4 py-3 text-sm text-slate-800">
        {{ statusMessage }}
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-project-blue/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-project-blue/15"
          @click="refresh"
        >
          Obnovit
        </button>
        <button
          type="button"
          class="rounded-xl bg-project-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-project-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="saving"
          @click="saveSettings"
        >
          {{ saving ? "Ukládám..." : "Uložit nastavení" }}
        </button>
      </div>
    </section>
  </main>
</template>
