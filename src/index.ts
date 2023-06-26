import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import childProcess from "node:child_process";

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

Object.assign(process.env, loadEnvFiles(getEnvFiles(CWD)));

const proc = process.argv.slice(2);
const command = proc[0];
const args = proc.slice(1);

if (!command) {
  throw new Error(`Command ${command} not found`);
}

childProcess.spawnSync(command, args, {
  env: process.env,
  stdio: "inherit",
});
