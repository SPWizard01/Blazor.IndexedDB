import { IndexedDBRecordBase } from "./record";

export type IndexedDBGenericErrorResultType = "MultiEntryIndexWithMultipleKeyPaths" | "IndexKeyPathMismatch" | "SchemaVerificationError";

export type IndexedDBDatabaseActionResultType = "DatabaseOpenError" | "DatabaseUpgradeBlocked" | "DatabaseUpgradeBlocking" | "DatabaseInfo" | "DatabaseInfoError" | "DatabaseDeleted" | "DatabaseDeleteError" | "DatabaseOpened";
export type IndexedDBStoreActionResultType = "StoreNotFound" | "StoreCreationError" | "StoreCreated" | "StoreQueryError" | "StoreCleared";
export type IndexedDBIndexActionResultType = "IndexCreated" | "IndexNotFound" | "IndexCreationError";
export type IndexedDBCursorActionResultType = "CursorRecord" | "CursorNoMoreRecords" | "CursorFailure" | "CursorNotOpen" | "CursorClosed";
export type IndexedDBQueryActionResultType = "IDBKeyCreated" | "IDBKeyFailure";

export type IndexedDBRecordActionResultType = "Record" | "RecordDeleted" | "RecordNotFound" | "RecordQueryError";


export type IndexedDBActionResultType = IndexedDBCursorActionResultType | IndexedDBIndexActionResultType | IndexedDBGenericErrorResultType | IndexedDBStoreActionResultType | IndexedDBDatabaseActionResultType | IndexedDBQueryActionResultType | IndexedDBRecordActionResultType;
export interface IndexedDBActionResultBase {
    success: boolean;
    message: string;
    type: IndexedDBActionResultType;
}

export interface IndexedDBActionResultSuccess<T> extends IndexedDBActionResultBase {
    success: true
    result: IndexedDBRecordBase<T>;
}

export interface IndexedDBActionResultFailure extends IndexedDBActionResultBase {
    success: false;
    result: IndexedDBRecordBase<undefined>;
}

export type IndexedDBActionResult<T> = IndexedDBActionResultSuccess<T> | IndexedDBActionResultFailure;