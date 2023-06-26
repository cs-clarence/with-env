import type { UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default {
  plugins: [tsconfigPaths()],
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
} satisfies UserConfig;
