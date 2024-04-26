#!/usr/bin/env node

import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import childProcess from "child_process";
import { Command } from "@commander-js/extra-typings";
import { version } from "../package.json";

const CWD = process.cwd();
const ENVIRONMENT =
  process.env.ENVIRONMENT ??
  process.env.ENV ??
  process.env.NODE_ENV ??
  "development";

const FILE_LOAD_ORDER = defaultFileLoadOrder(
  ENVIRONMENT,
) as unknown as string[];
const ROOT_FILE_NAME = ".root";

function defaultFileLoadOrder<T extends string = string>(
  env: T,
  isPatch?: boolean,
) {
  if (isPatch) {
    return [`.env.${env}`, `.env.${env}.local`] as const;
  } else {
    return [".env", `.env.${env}`, ".env.local", `.env.${env}.local`] as const;
  }
}

// Parse a command into an array of arguments, should respect single and double quotes
function splitCommand(str: string): string[] {
  const result = [] as string[];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (const char of str) {
    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else {
      current += char;
    }
  }
  if (current) {
    result.push(current);
  }
  return result;
}

function getEnvFiles(
  searchPath: string,
  options?: Readonly<{
    findFromAncestorDirs?: boolean;
    environment?: string;
    fileNames?: string[] | undefined;
    filePaths?: string[] | undefined;
    limitToProjectRoot?: boolean;
    rootFileName?: string;
    isPatch?: boolean;
  }>,
): string[] {
  const envFilesQueue = [] as string[];
  let inRoot = false;
  const findFromAncestorDirs = options?.findFromAncestorDirs ?? true;
  const env = options?.environment ?? ENVIRONMENT;
  const fileNames = options?.fileNames ?? [];
  const files =
    fileNames.length !== 0
      ? fileNames
      : defaultFileLoadOrder(env, options?.isPatch);
  const rootFileName = options?.rootFileName ?? ROOT_FILE_NAME;
  const limitToProjectRoot = options?.limitToProjectRoot ?? true;

  if (options?.filePaths && options.filePaths.length !== 0) {
    for (const filePath of options.filePaths) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        envFilesQueue.push(filePath);
      } else {
        throw new Error(`Not a file: ${filePath}`);
      }
    }
  } else {
    while (!inRoot) {
      if (
        searchPath === "/" ||
        (limitToProjectRoot &&
          fs.existsSync(path.join(searchPath, rootFileName)))
      ) {
        inRoot = true;
      }

      for (const envFileName of files) {
        const filePath = path.join(searchPath, envFileName);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          envFilesQueue.push(filePath);

          if (!findFromAncestorDirs) {
            return envFilesQueue;
          }
        }
      }

      searchPath = path.parse(searchPath).dir;
    }
  }

  return envFilesQueue;
}

function loadEnvFiles(
  envFiles: string[],
  options: { cascade: boolean } = { cascade: true },
): Record<string, string> {
  const env = {} as Record<string, string>;

  for (const file of envFiles) {
    const buff = fs.readFileSync(file);

    const parsed = dotenv.parse(buff);

    for (const [key, value] of Object.entries(parsed)) {
      if (!env[key] || options.cascade) {
        env[key] = value;
      }
    }
  }

  const result = dotenvExpand.expand({ parsed: env, ignoreProcessEnv: true });

  if (result.error) {
    throw result.error;
  }

  return result.parsed ?? {};
}

const program = new Command();

program
  .name("WITH-ENV")
  .description("Run a command with .env files loaded")
  .version(version, "-V, --version", "output the current version");

program
  .argument("<cmd...>")
  .option("-d, --debug", "output extra debugging logs", false)
  .option(
    "--environment <env>",
    " CHARSET latin1 COLLATE latin1_swedish_ci AUTO_INCREMENT 5473override environment name (it uses environmental variables ENVIRONMENT or ENV or NODE_ENV or the string 'development' by default)",
    ENVIRONMENT,
  )
  .option(
    "-e, --env <env...>",
    "supply additional env variables to be loaded, in the form of KEY=VALUE",
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
  .option("-s, --search-path <search-path>", "path to find .env files", CWD)
  .option(
    "--file <filenames...>",
    "override the names of the env files to load, cascade will apply if enabled",
  )
  .option(
    "--path <filepaths...>",
    "use these full path to files to be loaded, overriding the default file finding algorithm, cascade will apply if enabled",
  )
  .option("-C, --no-cascade", "don't cascade env variables")
  .option(
    "-a, --ancestor-dirs",
    "find .env files in ancestor directories",
    true,
  )
  .option(
    "-A, --no-ancestor-dirs",
    "don't find .env files in ancestor directories",
    true,
  )
  .option(
    "-p, --patch <patches...>",
    "patch these env variables into the previously loaded env files, higher priority than variables from -e",
    [] as string[],
  )
  .action((cmd, opts) => {
    if (opts.debug) {
      console.log("Running Command: ", cmd);
      console.log("Options: ", opts);
    }

    const envFiles = getEnvFiles(opts.searchPath, {
      findFromAncestorDirs: opts.ancestorDirs,
      environment: opts.environment,
      fileNames: opts.file,
      filePaths: opts.path,
      rootFileName: opts.rootFileName,
      limitToProjectRoot: opts.limitToProjectRoot,
    });

    for (const environment of opts.patch) {
      const files = getEnvFiles(opts.searchPath, {
        findFromAncestorDirs: opts.ancestorDirs,
        environment,
        fileNames: opts.file,
        filePaths: opts.path,
        rootFileName: opts.rootFileName,
        limitToProjectRoot: opts.limitToProjectRoot,
        isPatch: true,
      });
      envFiles.push(...files);
    }

    const envs = loadEnvFiles(envFiles, opts);

    if (opts.debug) {
      console.log("CWD: ", CWD);
      console.log("Loaded Env Files:", envFiles.length ? "" : "none");
      for (const file of envFiles) {
        console.log(file);
      }
    }

    for (const [key, value] of Object.entries(envs)) {
      if (!envs[key] || opts.cascade) {
        process.env[key] = value;
      }
    }

    const RE = /^([A-Za-z0-9_]+)=(.*)$/;

    for (const env of opts.env ?? []) {
      const match = RE.exec(env);
      if (!match) {
        throw new Error(`Invalid env variable: ${env}`);
      }
      const [, key, value] = match;

      envs[key!] = value!;
    }

    if (opts.debug) {
      console.log("Env:", envs);
    }

    let [command, ...args] = cmd;

    if (!command) {
      throw new Error("No command supplied");
    }

    {
      let [first, ...tail] = splitCommand(command);

      if (!first) {
        throw new Error("No command supplied");
      }

      command = first;
      args = [...tail, ...args];
    }

    if (opts.debug) {
      console.log("Command: ", command);
      console.log("Args: ", args);
    }

    args = args.map((a) => {
      let newArg = a;

      for (const [key, value] of Object.entries(envs)) {
        newArg = newArg.replace(`\${${key}}`, value);
      }

      return newArg;
    });

    if (opts.debug) {
      console.log("Interpolated Args", args);
    }

    if (!command) {
      throw new Error("No command supplied");
    }

    if (opts.debug) {
      console.log("Command Output: ");
    }
    const res = childProcess.spawnSync(command, args, {
      env: process.env,
      stdio: "inherit",
    });

    if (res.error) {
      console.error(res.error);
      process.exit(res.status ?? 1);
    }
  });

program.parse(process.argv);
