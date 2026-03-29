import type { Config } from "tailwindcss";

export default <Partial<Config>>{
  content: [
    "./app.vue",
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./error.vue"
  ],
  theme: {
    extend: {
      colors: {
        project: {
          red: "#EE4F5A",
          blue: "#88C1E4",
          teal: "#22BCB4",
          lime: "#CADB39",
          white: "#FEFEFE"
        }
      }
    }
  }
};
