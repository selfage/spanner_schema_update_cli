import { DATABASE_ID, INSTANCE_ID, PROJECT_ID } from "./constants";
import { ChildProcess, exec } from "child_process";

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
    exec("gcloud emulators spanner start"),
  );
  // Wait a bit for Spanner emulator to start.
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  await promisifyProcess(
    exec(
      `gcloud spanner instances create ${INSTANCE_ID} --config=emulator-config --description="Test Instance" --nodes=1`,
      (error, stdout, stderr) => {
        console.log(stdout);
        console.error(stderr);
      },
    ),
  );
  await promisifyProcess(
    exec(
      `gcloud spanner database create ${DATABASE_ID} --instance=${INSTANCE_ID}`,
      (error, stdout, stderr) => {
        console.log(stdout);
        console.error(stderr);
      },
    ),
  );
  await promisifyProcess(
    exec(
      `npx spanage update ${ddlFile} -p ${PROJECT_ID} -i ${INSTANCE_ID} -d ${DATABASE_ID} -l`,
      (error, stdout, stderr) => {
        console.log(stdout);
        console.error(stderr);
      },
    ),
  );
  await spannerEmulator;
}
