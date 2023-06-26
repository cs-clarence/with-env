import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    lib: {
      entry: "./src/index.ts",
      formats: ["es", "cjs"],
      fileName(file, format) {
        if (format === "es") {
          return `${file}.es.js`;
        }
        if (format === "cjs") {
          return `${file}.cjs.js`;
        }

        return `${file}.js`;
      },
    },
  },
});
