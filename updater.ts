import fs = require("fs");
import { SCHEMA_DDL, SchemaDdl } from "./schema_ddl";
import { Database, Spanner } from "@google-cloud/spanner";
import { DatabaseAdminClient } from "@google-cloud/spanner/build/src/v1";
import { equalMessage } from "@selfage/message/comparator";
import { parseMessage } from "@selfage/message/parser";
import {
  deserializeMessage,
  serializeMessage,
} from "@selfage/message/serializer";

enum SchemaState {
  PENDING = 1,
  UPDATED = 2,
}

interface CreatedTable {
  name: string;
  columns: Set<string>;
  indexes: Set<string>;
}

async function createSchemaImageTableIfNotExists(
  databaseAdminClient: DatabaseAdminClient,
  projectId: string,
  instanceId: string,
  databaseId: string,
): Promise<void> {
  let createSchemaImageTable = `
  CREATE TABLE IF NOT EXISTS SchemaImage (
    versionId INT64 NOT NULL,
    schema BYTES(MAX) NOT NULL,
    state INT64 NOT NULL,
  ) PRIMARY KEY(versionId)`;
  let [operation] = await databaseAdminClient.updateDatabaseDdl({
    database: databaseAdminClient.databasePath(
      projectId,
      instanceId,
      databaseId,
    ),
    statements: [createSchemaImageTable],
  });
  console.log(`Waiting for creation of table SchemaImage to complete...`);
  await operation.promise();
  console.log(`Created table SchemaImage.`);
}

function insertNewSchemaImage(
  databaseClient: Database,
  versionId: number,
  schemaDdl: SchemaDdl,
): void {
  databaseClient.runTransaction(async (err, transction) => {
    if (err) {
      throw err;
    }
    await transction.run({
      sql: `INSERT SchemaImage (versionId, schema, state) VALUES (@versionId, @schema, @state)`,
      params: {
        versionId: `${versionId}`,
        schema: Buffer.from(serializeMessage(schemaDdl, SCHEMA_DDL)),
        state: `${SchemaState.PENDING}`,
      },
      types: {
        versionId: {
          type: "int64",
        },
        schema: {
          type: "bytes",
        },
        state: {
          type: "int64",
        },
      },
    });
    await transction.commit();
    console.log(`Inserted new schema with version ${versionId}.`);
  });
}

async function insertNewSchemaDdlIfNotExists(
  databaseClient: Database,
  newSchemaDdl: SchemaDdl,
): Promise<number> {
  let [rows] = await databaseClient.run({
    sql: `SELECT versionId, schema FROM SchemaImage ORDER BY versionId DESC LIMIT 1;`,
  });
  if (rows.length === 0) {
    insertNewSchemaImage(databaseClient, 1, newSchemaDdl);
    return 1;
  } else {
    let latestVersionId = rows[0].at(0).value;
    let latestSchemaDdl = deserializeMessage(rows[0].at(1).value, SCHEMA_DDL);
    if (!equalMessage(latestSchemaDdl, newSchemaDdl, SCHEMA_DDL)) {
      insertNewSchemaImage(databaseClient, latestVersionId + 1, newSchemaDdl);
      return latestVersionId + 1;
    } else {
      return latestVersionId;
    }
  }
}

export async function updateSchema(
  projectId: string,
  instanceId: string,
  databaseId: string,
  ddlFile: string,
): Promise<void> {
  let spanner = new Spanner({
    projectId,
  });
  let databaseAdminClient = spanner.getDatabaseAdminClient();
  await createSchemaImageTableIfNotExists(
    databaseAdminClient,
    projectId,
    instanceId,
    databaseId,
  );

  let newSchemaDdl = parseMessage(
    JSON.parse(fs.readFileSync(ddlFile).toString()),
    SCHEMA_DDL,
  );
  let instance = spanner.instance(instanceId);
  let databaseClient = instance.database(databaseId);
  let versionId = await insertNewSchemaDdlIfNotExists(
    databaseClient,
    newSchemaDdl,
  );

  let [rows] = await databaseClient.run({
    sql: `
      WITH
        t AS (
        SELECT
          t.table_name AS table_name,
          t.spanner_state AS table_spanner_state,
          ARRAY_AGG(c.column_name) AS column_names,
          ARRAY_AGG(c.spanner_state) AS column_spanner_states,
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
          1,
          2),
        i AS (
        SELECT
          t.table_name,
          ARRAY_AGG(i.index_name) AS index_names,
          ARRAY_AGG(i.index_state) AS index_states,
        FROM
          information_schema.tables AS t
        JOIN
          information_schema.indexes AS i
        ON
          t.table_name = i.table_name
        WHERE
          t.table_catalog = ''
          AND t.table_schema = ''
          AND t.table_name != 'SchemaImage'
          AND i.index_type = 'INDEX'
        GROUP BY
          1)
      SELECT
        t.table_name,
        t.table_spanner_state,
        t.column_names,
        t.column_spanner_states,
        i.index_names,
        i.index_states,
      FROM
        t
      LEFT JOIN
        i
      ON
        t.table_name = i.table_name;`,
  });
  let notCommittedErrors = new Array<string>();
  let createdTables = new Map<string, CreatedTable>();
  for (let row of rows) {
    let tableName = row.at(0).value;
    let tableSpannerState = row.at(1).value;
    if (tableSpannerState !== "COMMITTED") {
      notCommittedErrors.push(
        `Table ${tableName} not committed yet. Current state: ${tableSpannerState}.`,
      );
    }

    let columns = new Set<string>();
    for (let i = 0; i < row.at(2).value.length; i++) {
      let columnName = row.at(2).value[i];
      let columnSpannerState = row.at(3).value[i];
      if (columnSpannerState !== "COMMITTED") {
        notCommittedErrors.push(
          `Column ${tableName}.${columnName} not comitted yet. Current state: ${columnSpannerState}.`,
        );
      }
      columns.add(columnName);
    }

    let indexes = new Set<string>();
    if (row.at(4).value) {
      for (let i = 0; i < row.at(4).value.length; i++) {
        let indexName = row.at(4).value[i];
        let indexState = row.at(5).value[i];
        if (indexState !== "READ_WRITE") {
          notCommittedErrors.push(
            `Index ${indexName} is not ready yet. Current state: ${indexState}.`,
          );
        }
        indexes.add(row.at(4).value[i]);
      }
    }
    createdTables.set(tableName, {
      name: tableName,
      columns,
      indexes,
    });
  }
  if (notCommittedErrors.length > 0) {
    throw new Error(
      `Give up updating schema due to existing tables/columns not committed yet.\n${notCommittedErrors.join("\n")}`,
    );
  }

  let statements = new Array<string>();
  for (let table of newSchemaDdl.tables) {
    let createdTable = createdTables.get(table.name);
    if (!createdTable) {
      let createTableDdls = new Array<string>();
      createTableDdls.push(`CREATE TABLE ${table.name} (`);
      for (let column of table.columns) {
        createTableDdls.push(`${column.ddl},`);
      }
      createTableDdls.push(`) ${table.ddl}`);
      statements.push(createTableDdls.join(""));

      if (table.indexes) {
        for (let index of table.indexes) {
          statements.push(index.ddl);
        }
      }
    } else {
      for (let column of table.columns) {
        if (!createdTable.columns.has(column.name)) {
          statements.push(`ALTER TABLE ${table.name} ADD COLUMN ${column.ddl}`);
        } else {
          createdTable.columns.delete(column.name);
        }
      }
      for (let excessiveColumn of createdTable.columns) {
        statements.push(
          `ALTER TABLE ${table.name} DROP COLUMN ${excessiveColumn}`,
        );
      }
      if (table.indexes) {
        for (let index of table.indexes) {
          if (!createdTable.indexes.has(index.name)) {
            statements.push(index.ddl);
          } else {
            createdTable.indexes.delete(index.name);
          }
        }
      }
      for (let excessiveIndex of createdTable.indexes) {
        statements.push(`DROP INDEX ${excessiveIndex}`);
      }
    }
    createdTables.delete(table.name);
  }
  for (let excessiveTable of createdTables.values()) {
    for (let excessiveIndex of excessiveTable.indexes) {
      statements.push(`DROP INDEX ${excessiveIndex}`);
    }
    statements.push(`DROP TABLE ${excessiveTable.name}`);
  }

  console.log(`Executing the following statements:\n${statements.join("\n")}`);
  if (statements.length === 0) {
    console.log(
      `Database ${databaseId} version ${versionId} already up-to-date.`,
    );
  } else {
    let [operation] = await databaseAdminClient.updateDatabaseDdl({
      database: databaseAdminClient.databasePath(
        projectId,
        instanceId,
        databaseId,
      ),
      statements,
    });
    console.log(`Waiting for updating database ${databaseId} to complete...`);
    await operation.promise();
    console.log(`Updated database ${databaseId} version ${versionId}.`);
  }
}
