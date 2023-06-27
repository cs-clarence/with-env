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
      fileName: (format) => {
        if (format === "es") {
          return "index.js";
        }

        if (format === "cjs") {
          return "index.cjs";
        }

        return `index.${format}.js`;
      },
    },
  },
} satisfies UserConfig;
