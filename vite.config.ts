import type { UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { builtinModules } from "module";

const coreModules = builtinModules.flatMap((name) => [name, `node:${name}`]);

export default {
  plugins: [tsconfigPaths()],
  optimizeDeps: {},
  build: {
    target: ["node20"],
    outDir: "dist",
    rollupOptions: {
      external: [...coreModules],
    },
    lib: {
      entry: "./src/index.ts",
      formats: ["cjs"],
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
