export interface IndexedDBActionResult<T> {
    success: boolean;
    data: T;
    message: string;
    type?: string;
}