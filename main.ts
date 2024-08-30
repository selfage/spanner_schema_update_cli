#!/usr/bin/env node
import fs = require("fs");
import path = require("path");
import { Command } from "commander";
import { updateSchema } from "./updater";

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
    .alias("srl")
    .description(
      `Update Spanner database schema from a generated DDL file.`,
    )
    .requiredOption(
      "-p, --project-id <id>",
      `The GCP project id.`,
    )
    .requiredOption(
      "-i, --instance-id <id>",
      `The Spanner instance id.`,
    )
    .requiredOption(
      "-d, --database-id <id>",
      `The spanner database id inside the Spanner instance.`,
    )
    .action((ddlFile, options) =>
      updateSchema(
        options.projectId,
        options.instanceId,
        options.databaseId,
        ddlFile
      ),
    );
  await program.parseAsync();
}

main();
