import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import childProcess from "child_process";
import { Command } from "@commander-js/extra-typings";
import { version } from "../package.json";

const CWD = process.cwd();
const ENV =
  process.env.ENVIRONMENT ??
  process.env.ENV ??
  process.env.NODE_ENV ??
  "development";

function getEnvFiles(
  cwd: string,
  options: { cascade: boolean; findFromAncestorDirs: boolean } = {
    cascade: true,
    findFromAncestorDirs: true,
  },
): string[] {
  const envFilesQueue = [] as string[];
  const loadOrder = [`.env.${ENV}.local`, ".env.local", `.env.${ENV}`, ".env"];
  let inRoot = false;
  let searchPath: string | null = cwd;

  while (!inRoot) {
    if (searchPath === "/") {
      inRoot = true;
    }

    for (const envFileName of loadOrder) {
      const filePath = inRoot
        ? `${searchPath}${envFileName}`
        : `${searchPath}/${envFileName}`;
      if (fs.existsSync(filePath)) {
        envFilesQueue.push(filePath);
        if (!options.cascade) {
          break;
        }

        if (!options.findFromAncestorDirs) {
          return envFilesQueue;
        }
      }
    }

    searchPath = path.parse(searchPath).dir;
  }

  return envFilesQueue;
}

function loadEnvFiles(envFiles: string[]): Record<string, string> {
  const env = {} as Record<string, string>;

  for (const file of envFiles.reverse()) {
    const buff = fs.readFileSync(file);

    Object.assign(env, dotenv.parse(buff));
  }

  const result = dotenvExpand.expand({ parsed: env });

  if (result.error) {
    throw result.error;
  }

  return result.parsed ?? {};
}

const program = new Command();

program
  .name("WITH-ENV")
  .description("Run a command with .env files loaded")
  .version(version, "-v, --version", "output the current version");

program
  .argument("<cmd...>")
  .option("-d, --debug", "output extra debugging logs", false)
  .option(
    "-c, --cascade",
    "cascade env variables following the order .env, env.${environment}.local, .env.local, and env.${environment}.local",
    true,
  )
  .option(
    "-C, --no-cascade",
    "don't cascade env variables following the order .env, env.${environment}.local, .env.local, and env.${environment}.local",
  )
  .option(
    "-a, --ancestors-dirs",
    "find .env files in ancestor directories",
    true,
  )
  .option(
    "-A, --no-ancestors-dirs",
    "don't find .env files in ancestor directories",
    true,
  )
  .action((cmd, opts) => {
    if (opts.debug) {
      console.log("Running command: ", cmd.join(" "));
      console.log("Options: ", opts);
    }

    const envFiles = getEnvFiles(CWD, {
      cascade: opts.cascade,
      findFromAncestorDirs: opts.ancestorsDirs,
    });

    const env = loadEnvFiles(envFiles);

    if (opts.debug) {
      console.log("CWD: ", CWD);
      console.log("Loaded env files:", env.length ? "" : "none");
      for (const file of envFiles) {
        console.log(file);
      }

      console.log("Env parsed: ", env);
    }

    Object.assign(process.env, env);

    const command = cmd[0];
    const args = cmd.slice(1);

    if (!command) {
      throw new Error("No command supplied");
    }

    if (opts.debug) {
      console.log("Command output: ");
    }

    childProcess.spawnSync(command, args, {
      env: process.env,
      stdio: "inherit",
    });
  });

program.parse(process.argv);
