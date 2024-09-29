#!/usr/bin/env node
import fs = require("fs");
import path = require("path");
import { updateSchemaFromDdlFile } from "./updater";
import { Command } from "commander";

function stripFileExtension(file: string): string {
  let pathObj = path.parse(file);
  pathObj.base = undefined;
  pathObj.ext = undefined;
  return path.format(pathObj);
}

async function main(): Promise<void> {
  let packageConfig = JSON.parse(
    (
      await fs.promises.readFile(path.join(__dirname, "package.json"))
    ).toString(),
  );
  let program = new Command();
  program.version(packageConfig.version);
  program
    .command("update <ddlFile>")
    .description(
      `Update Spanner database schema from a generated DDL JSON file.`,
    )
    .requiredOption("-p, --project-id <id>", `The GCP project id.`)
    .requiredOption("-i, --instance-id <id>", `The Spanner instance id.`)
    .requiredOption(
      "-d, --database-id <id>",
      `The spanner database id inside the Spanner instance.`,
    )
    .option(
      "-h, --spanner-emulator-host",
      "The host address to connect to local Spanner emulator.",
    )
    .action((ddlFile, options) =>
      updateSchemaFromDdlFile(
        options.projectId,
        options.instanceId,
        options.databaseId,
        stripFileExtension(ddlFile) + ".json",
        options.spannerEmulatorHost,
      ),
    );
  await program.parseAsync();
}

main();
