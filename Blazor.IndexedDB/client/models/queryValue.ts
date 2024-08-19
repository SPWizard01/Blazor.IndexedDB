import { IndexedDBObjectBase } from "./record";

export type IndexedDBQueryValueType = "BoundQuery" | "LowerBoundQuery" | "UpperBoundQuery" | "OnlyQuery" | "ValidKeyQuery" | "NoQuery";
export interface IndexedDBQueryBase {
    queryType: IndexedDBQueryValueType
}
export interface IndexedDBBoundQuery extends IndexedDBQueryBase {
    queryType: "BoundQuery";
    lower: any;
    upper: any;
    lowerOpen: boolean;
    upperOpen: boolean;
}
export interface IndexedDBLowerBoundQuery extends IndexedDBQueryBase {
    queryType: "LowerBoundQuery";
    lowerBound: any;
    lowerOpen: boolean;
}
export interface IndexedDBUpperBoundQuery extends IndexedDBQueryBase {
    queryType: "UpperBoundQuery";
    upperBound: any;
    upperOpen: boolean;
}
export interface IndexedDBOnlyQuery extends IndexedDBQueryBase {
    queryType: "OnlyQuery";
    value: any;
}

export interface IndexedDBKeyValueQuery extends IndexedDBQueryBase {
    queryType: "ValidKeyQuery";
    value: IDBValidKey
}
export interface IndexedDBNoQuery extends IndexedDBQueryBase {
    queryType: "NoQuery";
}

export type IndexedDBQueryType = IndexedDBBoundQuery | IndexedDBLowerBoundQuery | IndexedDBUpperBoundQuery | IndexedDBOnlyQuery | IndexedDBKeyValueQuery | IndexedDBNoQuery;

export interface IndexedDBQueryConvertionKeyRange {
    type: "KeyRange";
    value: IDBKeyRange
}

export interface IndexedDBQueryConvertionValidKey {
    type: "ValidKey";
    value: IDBValidKey
}

export interface IndexedDBQueryConvertionNoQuery {
    type: "NoQuery";
    value: undefined
}

export type IndexedDBQueryConvertion = IndexedDBQueryConvertionKeyRange | IndexedDBQueryConvertionValidKey | IndexedDBQueryConvertionNoQuery;


export interface IndexedDBQuery extends IndexedDBObjectBase {
    queryValue: IndexedDBQueryType;
}
export interface IndexedDBIndexQuery extends IndexedDBQuery {
    indexName: string;
}