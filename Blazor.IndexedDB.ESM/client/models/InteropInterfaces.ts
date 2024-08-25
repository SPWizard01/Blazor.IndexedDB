import { IDBPDatabase } from "idb";
import { IndexedDBQuery } from "./queryValue";
import { type DotNet } from "@microsoft/dotnet-js-interop";

export interface IndexedDBJSConfig {
    dotNetReference: DotNet.DotNetObject;
    sendNotificationsFromJS: boolean;
}

/**Defines the Database to open or create.*/
export interface IIndexedDBDatabase {
    /**the name of the database*/
    name: string;
    /**The version for this instance. This value is used when opening a database to determine if it needs to be updated*/
    version: number;
    /**Defines the stores to be created in the database defined as IStoreSchema*/
    stores: IStoreSchema[];
}

export interface IndexedDBCursorQuery {
    initialQuery: IndexedDBQuery;
    cursorPosition: number;
    direction?: IDBCursorDirection;
}

export interface IIndexedDBDatabaseInstance {
    name: string;
    instance: IDBPDatabase;
    executingCursors: IndexedDBCursorQuery[];
}

/**Defines a store to be created in the database. */
export interface IStoreSchema {
    name: string;
    primaryKey: IIndexSpec;
    indexes: IIndexSpec[];
}
/** */


/**Index definition for a store */
export interface IIndexSpec {
    name: string;
    keyPath: string[];
    keepAsArrayOnSingleValue: boolean;
    unique: boolean;
    multiEntry: boolean;
    auto: boolean;
}

export interface DBInformation {
    name: string;
    version: number;
    storeNames: string[];
}



