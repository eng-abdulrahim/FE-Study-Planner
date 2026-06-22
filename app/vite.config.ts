/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" produces relative asset URLs so the static build works on GitHub
// Pages under any repository subpath (e.g. https://user.github.io/<repo>/) without
// needing to know the repo name at build time.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
