export interface IndexedDBActionResultBase {
    success: boolean;
    message: string;
    type?: string;
}

export interface IndexedDBActionResultSuccess<T> extends IndexedDBActionResultBase {
    success: true
    data: T;
}

export interface IndexedDBActionResultFailure extends IndexedDBActionResultBase {
    success: false;
    data: undefined;
}

export type IndexedDBActionResult<T> = IndexedDBActionResultSuccess<T> | IndexedDBActionResultFailure;

// export interface IndexedDBActionResult<T> {
//     success: boolean;
//     data: T;
//     message: string;
//     type?: string;
// }