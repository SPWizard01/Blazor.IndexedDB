import { IndexedDbManager } from './indexedDbBlazor';
import { type DotNet } from "@microsoft/dotnet-js-interop";
import { IndexedDBJSConfig } from './models/InteropInterfaces';

export let IDBManager: IndexedDbManager | undefined;
let _dbManagerRef: DotNet.DotNetObject | undefined;
export function initIndexedDbManager(config: IndexedDBJSConfig) {
    if (IDBManager) { return; }
    IDBManager = new IndexedDbManager(config);
    (window as any).dbManager = IDBManager;
    _dbManagerRef = config.dotNetReference;
    console.log("IndexedDbManager initialized");
}