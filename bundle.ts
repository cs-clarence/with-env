export {};

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: false,
  target: "node",
  format: "esm",
  splitting: true,
  external: ["commander", "dotenv", "dotenv-expand"],
});
