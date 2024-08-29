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
      console.error(err);
      return;
    }
    await transction.run({
      sql: `INSERT SchemaImage (versionId, schema, state) VALUES (@versionId, @schema, @state)`,
      params: {
        versionId: `${versionId}`,
        schema: serializeMessage(schemaDdl, SCHEMA_DDL),
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
): Promise<void> {
  let [rows] = await databaseClient.run({
    sql: `SELECT versionId, schema FROM SchemaImage ORDER BY versionId DESC LIMIT 1;`,
  });
  if (rows.length === 0) {
    insertNewSchemaImage(databaseClient, 1, newSchemaDdl);
  } else {
    let latestVersionId = rows[0].at(0).value;
    let latestSchemaDdl = deserializeMessage(rows[0].at(1).value, SCHEMA_DDL);
    if (!equalMessage(latestSchemaDdl, newSchemaDdl, SCHEMA_DDL)) {
      insertNewSchemaImage(databaseClient, latestVersionId + 1, newSchemaDdl);
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
  await insertNewSchemaDdlIfNotExists(databaseClient, newSchemaDdl);

  let [rows] = await databaseClient.run({
    sql: `
      SELECT
        t.table_name,
        t.spanner_state,
        ARRAY_AGG(c.column_name),
        ARRAY_AGG(c.spanner_state),
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
        2;`,
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
    if (!row.at(4).value) {
      for (let i = 0; i < row.at(4).value.length; i++) {
        let indexName = row.at(4).value[i];
        let indexState = row.at(5).value[i];
        if (indexState !== "READ_WRITE") {
          notCommittedErrors.push(
            `Index ${indexName} is not ready yet. Current state: ${indexState}.`,
          );
        }
        indexes.add(row.at(3).value[i]);
      }
    }
    createdTables.set(tableName, {
      name: tableName,
      columns,
      indexes,
    });
  }
  if (notCommittedErrors.length > 0) {
    console.error(
      `Give up updating schema due to existing tables/columns not committed yet.\n${notCommittedErrors.join("\n")}`,
    );
    return;
  }

  let ddls = new Array<string>();
  for (let table of newSchemaDdl.tables) {
    let createdTable = createdTables.get(table.name);
    if (!createdTable) {
      ddls.push(`CREATE TABLE ${table.name} (`);
      for (let column of table.columns) {
        ddls.push(`${column.ddl},`);
      }
      ddls.push(`) ${table.ddl};`);
      for (let index of table.indexes) {
        ddls.push(`${index.ddl};`);
      }
    } else {
      for (let column of table.columns) {
        if (!createdTable.columns.has(column.name)) {
          ddls.push(`ALTER TABLE ${table.name} ADD COLUMN ${column.ddl};`);
        } else {
          createdTable.columns.delete(column.name);
        }
      }
      for (let excessiveColumn of createdTable.columns) {
        ddls.push(`ALTER TABLE ${table.name} DROP COLUMN ${excessiveColumn};`);
      }
      for (let index of table.indexes) {
        if (!createdTable.indexes.has(index.name)) {
          ddls.push(`${index.ddl};`);
        } else {
          createdTable.indexes.delete(index.name);
        }
      }
      for (let excessiveIndex of createdTable.indexes) {
        ddls.push(`DROP INDEX ${excessiveIndex};`);
      }
    }
    createdTables.delete(table.name);
  }
  for (let excessiveTable of createdTables.values()) {
    for (let excessiveIndex of excessiveTable.indexes) {
      ddls.push(`DROP INDEX ${excessiveIndex};`);
    }
    ddls.push(`DROP TABLE ${excessiveTable.name};`);
  }

  let [operation] = await databaseAdminClient.updateDatabaseDdl({
    database: databaseAdminClient.databasePath(
      projectId,
      instanceId,
      databaseId,
    ),
    statements: [ddls.join("")],
  });
  console.log(`Waiting for updating database ${databaseId} to complete...`);
  await operation.promise();
  console.log(`Updated database ${databaseId}.`);
}
