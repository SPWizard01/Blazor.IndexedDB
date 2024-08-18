import { IDBPDatabase } from "idb";
import { IndexedDBQuery } from "./queryValue";

/**Defines the Database to open or create.*/
export interface IIndexedDBDatabase {
    /**the name of the database*/
    name: string;
    /**The version for this instance. This value is used when opening a database to determine if it needs to be updated*/
    version: number;
    /**Defines the stores to be created in the database defined as IStoreSchema*/
    stores: IStoreSchema[];
}

export interface IIndexedDBDatabaseInstance {
    name: string;
    instance: IDBPDatabase;
}

/**Defines a store to be created in the database. */
export interface IStoreSchema {
    name: string;
    primaryKey: IIndexSpec;
    indexes: IIndexSpec[];
}
/** */
export interface IStoreRecord {
    storeName: string;
    key?: any;
    data: any;
}

export interface IndexedDBSearch {
    storeName: string;
    queryValue: IndexedDBQuery;
}
export interface IndexedDBQuerySearch extends IndexedDBSearch {
    indexName: string;
}

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



