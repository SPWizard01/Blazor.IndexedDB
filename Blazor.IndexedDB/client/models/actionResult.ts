import { IndexedDBRecordBase } from "./record";

export interface IndexedDBActionResultBase {
    success: boolean;
    message: string;
    type?: string;
}

export interface IndexedDBActionResultSuccess<T> extends IndexedDBActionResultBase {
    success: true
    result: IndexedDBRecordBase<T>;
}

export interface IndexedDBActionResultFailure extends IndexedDBActionResultBase {
    success: false;
    data: undefined;
}

export type IndexedDBActionResult<T> = IndexedDBActionResultSuccess<T> | IndexedDBActionResultFailure;