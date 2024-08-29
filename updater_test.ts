import { updateSchema } from "./updater";
import { Spanner } from "@google-cloud/spanner";

let PROJECT_ID = process.env.PROJECT_ID;
let INSTANCE_ID = process.env.INSTANCE_ID;
let DATABASE_ID = process.env.DATABASE_ID;
let SPANNER = new Spanner({
  projectId: PROJECT_ID,
});
let DATABASE_ADMIN_CLIENT = SPANNER.getDatabaseAdminClient();

async function execute(): Promise<void> {
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );
  
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );

  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v2.json",
  );

  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );
}

async function runTest(): Promise<void> {
  let [operation] = await DATABASE_ADMIN_CLIENT.createDatabase({
    createStatement: "CREATE DATABASE `" + DATABASE_ID + "`",
    parent: DATABASE_ADMIN_CLIENT.instancePath(PROJECT_ID, INSTANCE_ID),
  });
  await operation.promise();

  try {
    await execute();
  } finally {
    // await DATABASE_ADMIN_CLIENT.dropDatabase({
    //   database: DATABASE_ID,
    // });
  }
}

runTest();
