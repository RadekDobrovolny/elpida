<script setup lang="ts">
const creating = ref(false);

async function createCourse() {
  creating.value = true;
  try {
    const created = await $fetch<{ id: string }>("/api/course", { method: "POST" });
    await navigateTo(`/courses/${created.id}`);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-project-white p-6">
    <div class="w-full max-w-3xl rounded-3xl border border-project-blue/60 bg-project-white p-8 text-center shadow-sm md:p-12">
      <h1 class="text-4xl font-bold tracking-tight text-project-teal md:text-5xl">Průvodce tvorbou kurzu</h1>
      <p class="mt-4 text-lg text-slate-600">Vytvoř si návrh vzdělávacího kurzu krok za krokem s AI průvodkyní Valérií.</p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          class="rounded-xl bg-project-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-project-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="creating"
          @click="createCourse"
        >
          {{ creating ? "Vytvářím..." : "Začít nový kurz" }}
        </button>
        <NuxtLink
          to="/courses"
          class="rounded-xl border border-project-teal bg-project-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-project-teal/15"
        >
          Otevřít knihovnu
        </NuxtLink>
      </div>
    </div>
  </main>
</template>
