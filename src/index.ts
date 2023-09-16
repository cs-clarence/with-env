#!/usr/bin/env bun

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

const FILE_LOAD_ORDER = defaultFileLoadOrder(ENV) as unknown as string[];
const ROOT_FILE_NAME = ".root";

function defaultFileLoadOrder<T extends string = string>(env: T) {
  return [".env", `.env.${env}`, ".env.local", `.env.${env}.local`] as const;
}

function getEnvFiles(
  cwd: string,
  options?: Readonly<{
    findFromAncestorDirs?: boolean;
    env?: string;
    fileNames?: string[];
    searchPath?: string;
    limitToProjectRoot?: boolean;
    rootFileName?: string;
  }>,
): string[] {
  const envFilesQueue = [] as string[];
  let inRoot = false;
  const findFromAncestorDirs = options?.findFromAncestorDirs ?? true;
  const env = options?.env ?? ENV;
  const fileNames = options?.fileNames ?? [];
  const files = fileNames.length !== 0 ? fileNames : defaultFileLoadOrder(env);
  const rootFileName = options?.rootFileName ?? ROOT_FILE_NAME;
  const limitToProjectRoot = options?.limitToProjectRoot ?? true;

  let searchPath: string | null = options?.searchPath ?? cwd;

  while (!inRoot) {
    if (
      searchPath === "/" ||
      (limitToProjectRoot && fs.existsSync(path.join(searchPath, rootFileName)))
    ) {
      inRoot = true;
    }

    for (const envFileName of files) {
      const filePath = path.join(searchPath, envFileName);

      if (fs.existsSync(filePath)) {
        envFilesQueue.push(filePath);

        if (findFromAncestorDirs) {
          return envFilesQueue;
        }
      }
    }

    searchPath = path.parse(searchPath).dir;
  }

  return envFilesQueue;
}

function loadEnvFiles(
  envFiles: string[],
  options: { cascade: boolean } = { cascade: true },
): Record<string, string> {
  const env = {} as Record<string, string>;

  for (const file of envFiles.reverse()) {
    const buff = fs.readFileSync(file);

    const parsed = dotenv.parse(buff);

    for (const [key, value] of Object.entries(parsed)) {
      if (!env[key] || options.cascade) {
        env[key] = value;
      }
    }
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
    "-e, --env <env>",
    "override environment name (it uses environmental variables ENVIRONMENT or ENV or NODE_ENV or the string 'development' by default)",
    ENV,
  )
  .option(
    "-c, --cascade",
    `cascade env variables following the order: ${FILE_LOAD_ORDER.join(
      ",",
    )}, the variables in the later file override the previous ones`,
    true,
  )
  .option("-C, --no-cascade", `disable cascade`, false)
  .option(
    "-r, --root-file-name <rootFileName>",
    "root file name",
    ROOT_FILE_NAME,
  )
  .option(
    "-l, --limit-to-project-root",
    `limit the ancestor search to the directory containing the project root file (${ROOT_FILE_NAME}, overrideable with -r flag)`,
    true,
  )
  .option(
    "-L, --no-limit-to-project-root",
    "ignore the project root file and search for .env files in all ancestor directories",
    true,
  )
  .option("-p, --path <path>", "path to find .env files", CWD)
  .option(
    "-f, --file-names <filenames...>",
    "override the names of the env files to load, cascade will apply if enabled",
    [],
  )
  .option("-C, --no-cascade", "don't cascade env variables")
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
      console.log("Running command: ", cmd);
      console.log("Options: ", opts);
    }

    const envFiles = getEnvFiles(CWD, {
      findFromAncestorDirs: opts.ancestorsDirs,
      env: opts.env,
      searchPath: opts.path,
      fileNames: opts.fileNames,
      rootFileName: opts.rootFileName,
      limitToProjectRoot: opts.limitToProjectRoot,
    });

    const env = loadEnvFiles(envFiles, opts);

    if (opts.debug) {
      console.log("CWD: ", CWD);
      console.log("Loaded env files:", env.length ? "" : "none");
      for (const file of envFiles) {
        console.log(file);
      }

      console.log("Env parsed: ", env);
    }

    for (const [key, value] of Object.entries(env)) {
      if (!env[key] || opts.cascade) {
        process.env[key] = value;
      }
    }

    if (opts.debug) {
      console.log("Command output: ");
    }
    let [command, ...args] = cmd;

    if (!command) {
      throw new Error("No command supplied");
    }

    {
      let [first, ...tail] = command.split(/\s+/);

      if (!first) {
        throw new Error("No command supplied");
      }

      command = first;
      args = [...tail, ...args];
    }

    if (!command) {
      throw new Error("No command supplied");
    }

    const res = childProcess.spawnSync(command, args, {
      env: process.env,
      stdio: "inherit",
    });

    if (res.error) {
      throw new Error(`An error occured when running the command: ${cmd}`, {
        cause: res.error,
      });
    }
  });

program.parse(process.argv);
