import { DATABASE_ID, INSTANCE_ID, PROJECT_ID } from "./constants";
import { ChildProcess, spawn } from "child_process";

function promisifyProcess(childProcess: ChildProcess): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    childProcess.on("exit", (code) => {
      process.exitCode = code;
      if (code !== 0) {
        reject(new Error("Child process exited with non-zero code."));
      }
      resolve();
    });
    childProcess.on("error", (err) => {
      reject(err);
    });
  });
}

export async function runEmulator(ddlFile: string): Promise<void> {
  let spannerEmulator = promisifyProcess(
    spawn("gcloud", ["emulators", "spanner", "start"], {
      stdio: "inherit",
    }),
  );
  // Wait a bit for Spanner emulator to start.
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  await promisifyProcess(
    spawn(
      "gcloud",
      [
        "spanner",
        "instances",
        "create",
        INSTANCE_ID,
        "--config=emulator-config",
        `--description="Test Instance"`,
        "--nodes=1",
      ],
      { stdio: "inherit" },
    ),
  );
  await promisifyProcess(
    spawn(
      "gcloud",
      [
        "spanner",
        "databases",
        "create",
        DATABASE_ID,
        "--instance=test-instance",
      ],
      { stdio: "inherit" },
    ),
  );
  await promisifyProcess(
    spawn(
      "npx",
      [
        "spanage",
        "update",
        ddlFile,
        "-p",
        PROJECT_ID,
        "-i",
        INSTANCE_ID,
        "-d",
        DATABASE_ID,
        "-l",
      ],
      { stdio: "inherit" },
    ),
  );
  await spannerEmulator;
}
