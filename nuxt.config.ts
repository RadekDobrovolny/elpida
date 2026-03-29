export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/main.css"],
  vite: {
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"]
    }
  },
  runtimeConfig: {
    geminiApiKey: "",
    geminiModel: "gemini-3.1-flash-lite-preview",
    public: {}
  }
});
