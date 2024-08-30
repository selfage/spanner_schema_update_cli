import { SchemaState, updateSchema } from "./updater";
import { Spanner } from "@google-cloud/spanner";
import { assertThat, eq, isArray } from "@selfage/test_matcher";

let PROJECT_ID = process.env.PROJECT_ID;
let INSTANCE_ID = process.env.INSTANCE_ID;
let DATABASE_ID = process.env.DATABASE_ID;
let SPANNER = new Spanner({
  projectId: PROJECT_ID,
});
let DATABASE_ADMIN_CLIENT = SPANNER.getDatabaseAdminClient();

async function execute(): Promise<void> {
  // Prepare
  let instance = SPANNER.instance(INSTANCE_ID);
  let databaseClient = instance.database(DATABASE_ID);

  // Execute
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );

  // Verify
  {
    let [rows] = await databaseClient.run({
      sql: `
      SELECT
        versionId,
        state,
      FROM
        SchemaImage
      ORDER BY
        versionId DESC
      LIMIT 1`,
    });
    let schemaImage = rows[0].toJSON();
    assertThat(schemaImage.versionId, eq(1), "Schema V1");
    assertThat(
      schemaImage.state,
      eq(SchemaState.DONE),
      "Schema V1 update done",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        t.table_name AS table_name,
        ARRAY_AGG(c.column_name) AS column_names,
      FROM
        information_schema.tables AS t
      JOIN
        information_schema.columns AS c
      ON
        t.table_name = c.table_name
      WHERE
        t.table_catalog = ''
        AND t.table_schema = ''
        AND t.table_name != 'SchemaImage'
      GROUP BY
        1`,
    });
    assertThat(rows.length, eq(1), "One table created");
    let table = rows[0].toJSON();
    assertThat(table.table_name, eq("Singers"), "Table Singers created");
    assertThat(
      table.column_names,
      isArray([eq("SingerId"), eq("FirstName")]),
      "Singers's columns created",
    );
  }

  // Execute
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );

  // Verify no update
  {
    let [rows] = await databaseClient.run({
      sql: `
      SELECT
        versionId,
        state,
      FROM
        SchemaImage
      ORDER BY
        versionId DESC
      LIMIT 1`,
    });
    assertThat(rows[0].toJSON().versionId, eq(1), "Still Schema V1");
  }

  // Execute
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v2.json",
  );

  // Verify
  {
    let [rows] = await databaseClient.run({
      sql: `
      SELECT
        versionId,
        state,
      FROM
        SchemaImage
      ORDER BY
        versionId DESC
      LIMIT 1`,
    });
    let schemaImage = rows[0].toJSON();
    assertThat(schemaImage.versionId, eq(2), "Schema V2");
    assertThat(
      schemaImage.state,
      eq(SchemaState.DONE),
      "Schema V2 update done",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        t.table_name AS table_name,
      FROM
        information_schema.tables AS t
      WHERE
        t.table_catalog = ''
        AND t.table_schema = ''
        AND t.table_name != 'SchemaImage'
      ORDER BY
        1`,
    });
    assertThat(rows.length, eq(2), "Two tables created");
    assertThat(rows[0].toJSON().table_name, eq("Albums"), "Table 0 Albums");
    assertThat(rows[1].toJSON().table_name, eq("Singers"), "Table 1 Singers");
    [rows] = await databaseClient.run({
      sql: `
      SELECT
        c.column_name AS column_name,
      FROM
        information_schema.columns AS c
      WHERE
        c.table_catalog = ''
        AND c.table_schema = ''
        AND c.table_name = 'Singers'`,
    });
    assertThat(rows.length, eq(3), "3 columns of Singers");
    let columns = rows.map((row) => row.at(0).value);
    assertThat(
      columns,
      isArray([eq("SingerId"), eq("FirstName"), eq("LastName")]),
      "Singers V2 columns",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        i.index_name AS index_name,
      FROM
        information_schema.indexes AS i
      WHERE
        i.table_catalog = ''
        AND i.table_schema = ''
        AND i.table_name = 'Singers'
        And i.index_type = 'INDEX'`,
    });
    assertThat(rows.length, eq(2), "2 indexes of Singers");
    let indexes = rows.map((row) => row.at(0).value);
    assertThat(
      indexes,
      isArray([eq("SingersByFirstName"), eq("SingersByLastName")]),
      "Singers V2 indexes",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        c.column_name AS column_name,
      FROM
        information_schema.columns AS c
      WHERE
        c.table_catalog = ''
        AND c.table_schema = ''
        AND c.table_name = 'Albums'`,
    });
    assertThat(rows.length, eq(3), "3 columns of Albums");
    columns = rows.map((row) => row.at(0).value);
    assertThat(
      columns,
      isArray([eq("SingerId"), eq("AlbumId"), eq("AlbumTitle")]),
      "Albums V2 columns",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        i.index_name AS index_name,
      FROM
        information_schema.indexes AS i
      WHERE
        i.table_catalog = ''
        AND i.table_schema = ''
        AND i.table_name = 'Albums'
        And i.index_type = 'INDEX'`,
    });
    assertThat(rows.length, eq(1), "1 index of Albums");
    indexes = rows.map((row) => row.at(0).value);
    assertThat(indexes, isArray([eq("AlbumsByTitle")]), "Albums V2 indexes");
  }

  // Execute
  await updateSchema(
    PROJECT_ID,
    INSTANCE_ID,
    DATABASE_ID,
    "./test_data/schema_v1.json",
  );

  // Verify
  {
    let [rows] = await databaseClient.run({
      sql: `
      SELECT
        versionId,
        state,
      FROM
        SchemaImage
      ORDER BY
        versionId DESC
      LIMIT 1`,
    });
    let schemaImage = rows[0].toJSON();
    assertThat(schemaImage.versionId, eq(3), "Schema V3");
    assertThat(
      schemaImage.state,
      eq(SchemaState.DONE),
      "Schema V3 update done",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        t.table_name AS table_name,
      FROM
        information_schema.tables AS t
      WHERE
        t.table_catalog = ''
        AND t.table_schema = ''
        AND t.table_name != 'SchemaImage'`,
    });
    assertThat(rows.length, eq(1), "One table left");
    assertThat(
      rows[0].toJSON().table_name,
      eq("Singers"),
      "Table Singers left",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        c.column_name AS column_name,
      FROM
        information_schema.columns AS c
      WHERE
        c.table_catalog = ''
        AND c.table_schema = ''
        AND c.table_name = 'Singers'`,
    });
    assertThat(rows.length, eq(2), "2 columns of Singers");
    let columns = rows.map((row) => row.at(0).value);
    assertThat(
      columns,
      isArray([eq("SingerId"), eq("FirstName")]),
      "Singers V3 columns",
    );

    [rows] = await databaseClient.run({
      sql: `
      SELECT
        i.index_name AS index_name,
      FROM
        information_schema.indexes AS i
      WHERE
        i.table_catalog = ''
        AND i.table_schema = ''
        AND i.table_name = 'Singers'
        And i.index_type = 'INDEX'`,
    });
    assertThat(rows.length, eq(0), "0 indexes of Singers left");
  }
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
    //   database: DATABASE_ADMIN_CLIENT.databasePath(
    //     PROJECT_ID,
    //     INSTANCE_ID,
    //     DATABASE_ID,
    //   ),
    // });
  }
}

runTest();
