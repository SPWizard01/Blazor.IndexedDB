export type IndexedDBQueryType = "BoundQuery" | "LowerBoundQuery" | "UpperBoundQuery" | "OnlyQuery" | "ValidKeyQuery";
export interface IndexedDBQueryBase {
    queryType: IndexedDBQueryType
}
export interface IndexedDBBoundQuery extends IndexedDBQueryBase {
    queryType: "BoundQuery";
    lowerBound: any;
    upperBound: any;
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

export type IndexedDBQuery = IndexedDBBoundQuery | IndexedDBLowerBoundQuery | IndexedDBUpperBoundQuery | IndexedDBOnlyQuery | IndexedDBKeyValueQuery;

export interface IndexedDBQueryConvertionKeyRange {
    type: "KeyRange";
    value: IDBKeyRange
}

export interface IndexedDBQueryConvertionValidKey {
    type: "ValidKey";
    value: IDBValidKey
}

export type IndexedDBQueryConvertion = IndexedDBQueryConvertionKeyRange | IndexedDBQueryConvertionValidKey;