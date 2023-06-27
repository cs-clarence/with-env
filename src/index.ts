import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import childProcess from "node:child_process";
import { Command } from "@commander-js/extra-typings";
import figlet from "figlet";

const ASCII_ART = figlet.textSync("WITH-ENV");

const CWD = process.cwd();

function getEnvFiles(cwd: string): string[] {
  const envFilesQueue = [] as string[];
  const NODE_ENV = process.env.NODE_ENV ?? "development";
  const loadOrder = [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, ".env"];
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
  .name("\n" + ASCII_ART + "\n")
  .description("Run a command with .env files loaded")
  .version("0.0.3", "-v, --version", "output the current version");

program
  .argument("<cmd...>")
  .option("-d, --debug", "output extra debugging logs", false)
  .action((cmd, opts) => {
    const envFiles = getEnvFiles(CWD);

    const env = loadEnvFiles(envFiles);

    if (opts.debug) {
      console.log("Loaded env files: ");
      for (const file of envFiles) {
        console.log(file);
      }

      console.log("env parsed: ", env);
    }

    Object.assign(process.env, env);

    const command = cmd[0];
    const args = cmd.slice(1);

    if (!command) {
      throw new Error("No command supplied");
    }

    childProcess.spawnSync(command, args, {
      env: process.env,
      stdio: "inherit",
    });
  });

program.parse(process.argv);
