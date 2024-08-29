import { MessageDescriptor, PrimitiveType } from '@selfage/message/descriptor';

export interface TableColumnDdl {
  name?: string,
/* column_name data_type [ column_expression ] [ options_def ] */
  ddl?: string,
}

export let TABLE_COLUMN_DDL: MessageDescriptor<TableColumnDdl> = {
  name: 'TableColumnDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
    },
    {
      name: 'ddl',
      primitiveType: PrimitiveType.STRING,
    },
  ]
};

export interface IndexDdl {
  name?: string,
/* CREATE [UNIQUE] INDEX ... */
  ddl?: string,
}

export let INDEX_DDL: MessageDescriptor<IndexDdl> = {
  name: 'IndexDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
    },
    {
      name: 'ddl',
      primitiveType: PrimitiveType.STRING,
    },
  ]
};

export interface TableDdl {
  name?: string,
  columns?: Array<TableColumnDdl>,
/* PRIMARY KEY ( [column_name [ { ASC | DESC } ], ...] ) [ INTERLEAVE IN PARENT table_name ] ... */
  ddl?: string,
  indexes?: Array<IndexDdl>,
}

export let TABLE_DDL: MessageDescriptor<TableDdl> = {
  name: 'TableDdl',
  fields: [
    {
      name: 'name',
      primitiveType: PrimitiveType.STRING,
    },
    {
      name: 'columns',
      messageType: TABLE_COLUMN_DDL,
      isArray: true,
    },
    {
      name: 'ddl',
      primitiveType: PrimitiveType.STRING,
    },
    {
      name: 'indexes',
      messageType: INDEX_DDL,
      isArray: true,
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
    },
  ]
};
