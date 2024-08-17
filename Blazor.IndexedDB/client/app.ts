import { IndexedDbManager } from './indexedDbBlazor';
import { DotNet } from "@microsoft/dotnet-js-interop";

export let IDBManager: IndexedDbManager | undefined;
let _dbManagerRef: DotNet.DotNetObject | undefined;
export function initIndexedDbManager(dbManagerRef: DotNet.DotNetObject) {
    if (IDBManager) { return; }
    IDBManager = new IndexedDbManager(dbManagerRef);
    (window as any).dbManager = IDBManager;
    _dbManagerRef = dbManagerRef;
    console.log("IndexedDbManager initialized");
}