import type { UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default {
  plugins: [tsconfigPaths()],
  optimizeDeps: {},
  build: {
    outDir: "dist",
    rollupOptions: {
      external: [
        "os",
        "path",
        "crypto",
        "node:child_process",
        "node:path",
        "node:fs",
      ],
    },
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
