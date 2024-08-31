import { MessageDescriptor, PrimitiveType } from '@selfage/message/descriptor';

export interface TableColumnDdl {
  name?: string,
/* ALTER TABLE table_name ADD COLUMN column_name ... */
  addColumnDdl?: string,
}

export let TABLE_COLUMN_DDL: MessageDescriptor<TableColumnDdl> = {
  name: 'TableColumnDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
      index: 1,
    },
    {
      name: 'addColumnDdl',
      primitiveType: PrimitiveType.STRING,
      index: 2,
    },
  ]
};

export interface IndexDdl {
  name?: string,
/* CREATE INDEX index_name ON table_name ... */
  createIndexDdl?: string,
}

export let INDEX_DDL: MessageDescriptor<IndexDdl> = {
  name: 'IndexDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
      index: 1,
    },
    {
      name: 'createIndexDdl',
      primitiveType: PrimitiveType.STRING,
      index: 2,
    },
  ]
};

export interface TableDdl {
  name?: string,
  columns?: Array<TableColumnDdl>,
/* CREATE TABLE table_name (columns...) PRIMARY KEY (keys...) */
  createTableDdl?: string,
  indexes?: Array<IndexDdl>,
}

export let TABLE_DDL: MessageDescriptor<TableDdl> = {
  name: 'TableDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
      index: 1,
    },
    {
      name: 'columns',
      messageType: TABLE_COLUMN_DDL,
      isArray: true,
      index: 2,
    },
    {
      name: 'createTableDdl',
      primitiveType: PrimitiveType.STRING,
      index: 3,
    },
    {
      name: 'indexes',
      messageType: INDEX_DDL,
      isArray: true,
      index: 4,
    },
  ]
};

export interface SchemaDdl {
  tables?: Array<TableDdl>,
}

export let SCHEMA_DDL: MessageDescriptor<SchemaDdl> = {
  name: 'SchemaDdl',
  fields: [
    {
      name: 'tables',
      messageType: TABLE_DDL,
      isArray: true,
      index: 1,
    },
  ]
};
