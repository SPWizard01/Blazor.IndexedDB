import { IndexedDBQuery, IndexedDBQueryType } from "./queryValue";

export interface IndexedDBObjectBase {
    databaseName: string;
    storeName: string;
}

export interface IndexedDBRecordBase<T extends any> extends IndexedDBObjectBase {
    data: T;
}
export interface IndexedDBRecordAction extends IndexedDBRecordBase<any>, IndexedDBQuery {
    useKey: boolean;
}