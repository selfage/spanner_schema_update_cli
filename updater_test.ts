import { updateSchema } from "./updater";
import { Spanner } from "@google-cloud/spanner";
import { TEST_RUNNER } from "@selfage/test_runner";

let PROJECT_ID = process.env.PROJECT_ID;
let INSTANCE_ID = process.env.INSTANCE_ID;
let DATABASE_ID = process.env.DATABASE_ID;
let SPANNER = new Spanner({
  projectId: PROJECT_ID,
});
let DATABASE_ADMIN_CLIENT = SPANNER.getDatabaseAdminClient();

TEST_RUNNER.run({
  name: "UpdaterTest",
  environment: {
    setUp: async () => {
      let [operation] = await DATABASE_ADMIN_CLIENT.createDatabase({
        createStatement: "CREATE DATABASE `" + DATABASE_ID + "`",
        parent: DATABASE_ADMIN_CLIENT.instancePath(PROJECT_ID, INSTANCE_ID),
      });
      await operation.promise();
    },
    tearDown: async () => {
      // await DATABASE_ADMIN_CLIENT.dropDatabase({
      //   database: DATABASE_ID,
      // });
    },
  },
  cases: [
    {
      name: "InitialUpdateToV1_UpdateToV2_RevertToV1",
      execute: async () => {
        await updateSchema(
          PROJECT_ID,
          INSTANCE_ID,
          DATABASE_ID,
          "./test_data/schema_v1.json",
        );
      },
    },
  ],
});
