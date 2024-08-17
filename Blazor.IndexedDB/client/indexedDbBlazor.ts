import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames, IDBPTransaction } from "idb";
import { IDbStore, IndexedDBQuerySearch, IStoreRecord, IStoreSchema, DBInformation, IIndexSpec, IndexedDBSearch } from "./models/InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
import { UpgradeOutcome } from "./models/upgradeOutcome";
import { IndexedDBActionResult, IndexedDBActionResultFailure, IndexedDBActionResultSuccess } from "./models/actionResult";
import { IndexedDBQuery, IndexedDBQueryConvertion } from "./models/queryValue";
// import { UPGRADE_CHANNEL } from "./utils";
const RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
//https://web.dev/articles/indexeddb
export class IndexedDbManager {

    private dbInstance: IDBPDatabase | undefined;
    private _dbManagerRef: DotNet.DotNetObject;
    // private upgradeChannel: BroadcastChannel; 

    constructor(dbManagerRef: DotNet.DotNetObject) {
        this._dbManagerRef = dbManagerRef;
    }


    public async openDb(data: IDbStore) {
        const dbStore = data;
        const dbOpenOutcomes: IndexedDBActionResult<any>[] = [];
        try {
            if (!this.dbInstance || this.dbInstance.version < dbStore.version) {
                if (this.dbInstance) {
                    this.dbInstance.close();
                }
                this.dbInstance = await openDB(dbStore.dbName, dbStore.version, {
                    upgrade: async (database, oldVersion, newVersion, transaction) => {

                        const outcomes = this.upgradeDatabase(database, dbStore, oldVersion, newVersion!, transaction);
                        await transaction.done;
                        dbOpenOutcomes.push(...outcomes);
                    },
                    blocked: async (currentVersion, blockedVersion, event) => {
                        const message = `Database upgrade blocked. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
                        console.warn(message, event);
                        dbOpenOutcomes.push(
                            this.getFailureResult(message, "DatabaseUpgradeBlocked"));
                    },
                    blocking: async (currentVersion, blockedVersion, event) => {
                        const message = `Database upgrade blocking. Current version: ${currentVersion}, Blocked version: ${blockedVersion}, trying to close db.`;
                        console.warn(message, event);
                        try {
                            this.dbInstance!.close();
                            dbOpenOutcomes.push(
                                this.getSuccessResult(message, undefined, "DatabaseUpgradeBlocking")
                            );
                        }
                        catch (e) {
                            const message = `Could not close db, will try again. ${e}`;
                            console.error(message);
                            dbOpenOutcomes.push(
                                this.getFailureResult(message, "DatabaseUpgradeBlocking")
                            );
                        }
                    }
                });
            }
        } catch (e) {
            const msg = `Could not open db ${e}`;
            console.error(msg);
            dbOpenOutcomes.push(
                this.getFailureResult(msg, "DatabaseOpenError")
            );
            return dbOpenOutcomes;
        }
        try {
            const result = await this.verifySchema(this.dbInstance, dbStore);
            dbOpenOutcomes.push(...result);

        }
        catch (e) {
            const msg = `Could not verify schema ${e}`;
            dbOpenOutcomes.push(
                this.getFailureResult(msg, "SchemaVerificationError")
            );
        }

        return dbOpenOutcomes;
    }

    private getStoreNames(list: TypedDOMStringList<StoreNames<any>>) {
        const names: string[] = [];
        for (const storeName of list) {
            names.push(storeName);
        }
        return names;
    }

    public async getDbInfo(dbName: string) {
        try {

            await this.ensureDatabaseOpen(dbName);
            const dbInfo: DBInformation = {
                name: this.dbInstance!.name,
                version: this.dbInstance!.version,
                storeNames: this.getStoreNames(this.dbInstance!.objectStoreNames)
            };

            return this.getSuccessResult("Database information retrieved", dbInfo);
        }
        catch (e) {
            return this.getFailureResult(`Error getting database information: ${e}`);
        }
    }


    public async deleteDb(dbName: string) {
        try {

            this.dbInstance?.close();

            await deleteDB(dbName);

            this.dbInstance = undefined;
            const msg = `The database ${dbName} has been deleted.`;
            return this.getSuccessResult(msg, undefined);
        }
        catch (e) {
            return this.getFailureResult(`Error deleting database: ${e}`);
        }
    }

    public async addRecord(record: IStoreRecord) {
        const stName = record.storeName;
        let itemToSave = record.data;


        try {
            const tx = this.getTransaction(stName, "readwrite");
            const objectStore = tx.objectStore(stName);

            itemToSave = this.removePrimaryKeyPropertyIfAutoIncrement(objectStore, itemToSave);
            if (!objectStore.add) {
                return this.getFailureResult("Add method not available on object store");
            }
            console.log(itemToSave)
            const result = await objectStore.add(itemToSave);
            const dbResult = await objectStore.get(result!);
            await tx.done;
            const msg = `Added new record with id ${result}`;
            return this.getSuccessResult(msg, dbResult);
        }
        catch (e) {
            return this.getFailureResult(`Error adding record: ${e}`);
        }

    }

    public async updateRecord(record: IStoreRecord) {
        const stName = record.storeName;
        try {
            const tx = this.getTransaction(stName, "readwrite");
            const objectStore = tx.objectStore(stName);
            if (!objectStore.put) {
                return this.getFailureResult("Put method not available on object store");
            }
            const result = await objectStore.put(record.data, record.key);
            const dbResult = await objectStore.get(result);
            await tx.done;
            const msg = `Updated record with id ${result}`;
            return this.getSuccessResult(msg, dbResult);

        }
        catch (e) {
            return this.getFailureResult(`Error updating record: ${e}`);
        }
    }



    public async deleteRecord(record: IStoreRecord): Promise<IndexedDBActionResult<any>> {
        if (!record.key) {
            return this.getFailureResult("Record key is required to delete a record");
        }
        const stName = record.storeName;

        try {
            const tx = this.getTransaction(stName, "readwrite");
            const objectStore = tx.objectStore(stName);
            if (!objectStore.delete) {
                return this.getFailureResult("delete method not available on object store");
            }
            await objectStore.delete(record.key);
            await tx.done;
            return this.getSuccessResult(`Deleted record with key ${record.key} from store ${stName}`, undefined);
        }
        catch (e) {
            return this.getFailureResult(`Error deleting record: ${e}`);
        }
    }

    public async deleteRecordByKey(storename: string, id: any): Promise<IndexedDBActionResult<any>> {

        try {
            const tx = this.getTransaction(storename, "readwrite");
            const objectStore = tx.objectStore(storename);
            if (!objectStore.delete) {
                return this.getFailureResult("delete method not available on object store");
            }
            await objectStore.delete(id);
            return this.getSuccessResult(`Deleted record with key ${id} from store ${storename}`, undefined);
        }
        catch (e) {
            return this.getFailureResult(`Error deleting record: ${e}`);
        }
    }

    public async clearStore(storeName: string) {

        try {
            const tx = this.getTransaction(storeName, "readwrite");
            await tx.objectStore(storeName).clear?.();
            await tx.done;
            return this.getSuccessResult(`Store ${storeName} cleared`, undefined);
        }
        catch (e) {
            return this.getFailureResult(`Error clearing store ${storeName}: ${e}`);
        }
    }



    //#region IndexQueries
    public async iterateRecordsByIndex(searchData: IndexedDBQuerySearch, direction?: IDBCursorDirection) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results: any[] = [];
            const recordIterator = index.iterate(idbKeyResult.data.value, direction);
            for await (const cursor of recordIterator) {
                results.push(cursor.value);
            }
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getRecordByIndex(searchData: IndexedDBQuerySearch) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.get(idbKeyResult.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllRecordsByIndexQuery(searchData: IndexedDBQuerySearch, count?: number) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAll(idbKeyResult.data.value, count)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllRecordsByIndex(searchData: IndexedDBQuerySearch) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAll()
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllKeysByIndex(searchData: IndexedDBQuerySearch, count?: number) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAllKeys(idbKeyResult.data.value, count)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getKeyByIndex(searchData: IndexedDBQuerySearch) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getKey(idbKeyResult.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }
    //#endregion

    //#region StoreRecordQueries
    public async iterateRecords(searchData: IndexedDBSearch, direction?: IDBCursorDirection) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results: any[] = [];
            const recordIterator = objectStore.iterate(idbKeyResult.data.value, direction);
            for await (const cursor of recordIterator) {
                results.push(cursor.value);
            }
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getRecord(searchData: IndexedDBSearch) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.get(idbKeyResult.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from table ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records table ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllRecords(searchData: IndexedDBSearch) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAll()
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllRecordsByQuery(searchData: IndexedDBSearch, count?: number) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAll(idbKeyResult.data.value, count)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllKeys(searchData: IndexedDBSearch, count?: number) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAllKeys(idbKeyResult.data.value, count)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getKey(searchData: IndexedDBSearch) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getKey(idbKeyResult.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }
    //#endregion


    private getIDBKey(query: IndexedDBQuery) {
        let result: IndexedDBQueryConvertion | undefined;
        console.log(query);
        switch (query.queryType) {
            case "BoundQuery":
                result = { type: "KeyRange", value: IDBKeyRange.bound(query.lowerBound, query.upperBound, query.lowerOpen, query.upperOpen) };

                break;
            case "LowerBoundQuery":
                result = { type: "KeyRange", value: IDBKeyRange.lowerBound(query.lowerBound, query.lowerOpen) };

                break;
            case "UpperBoundQuery":
                result = { type: "KeyRange", value: IDBKeyRange.upperBound(query.upperBound, query.upperOpen) };

                break;
            case "OnlyQuery":
                result = { type: "KeyRange", value: IDBKeyRange.only(query.value) };
                break;
            case "ValidKeyQuery":
                result = { type: "ValidKey", value: query.value };
                break;
            default:
                return this.getFailureResult(`Invalid query type ${(query as any).queryType}`);
        }
        return this.getSuccessResult<IndexedDBQueryConvertion>("IDBKey created", result);
    }


    private getIndexQuery(searchData: IndexedDBQuerySearch, transactionMode: IDBTransactionMode) {
        const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, transactionMode);
        const index = objectStore.index(searchData.indexName);
        return { index, tx, idbKeyResult };
    }

    private getStoreQuery(searchData: IndexedDBSearch, transactionMode: IDBTransactionMode) {
        const tx = this.getTransaction(searchData.storeName, transactionMode);
        const objectStore = tx.objectStore(searchData.storeName);
        const idbKeyResult = this.getIDBKey(searchData.queryValue);
        return { objectStore, tx, idbKeyResult };
    }

    private getTransaction(stName: string, mode: IDBTransactionMode) {
        const tx = this.dbInstance!.transaction(stName, mode);
        return tx;
    }

    private removePrimaryKeyPropertyIfAutoIncrement(objectStore: IDBPObjectStore<unknown, [string], string, "readonly" | "readwrite" | "versionchange">, data: any) {
        if (!objectStore.autoIncrement || !objectStore.keyPath) {
            return data;
        }

        if (!Array.isArray(objectStore.keyPath)) {
            if (Object.hasOwn(data, objectStore.keyPath)) {
                delete data[objectStore.keyPath];
            }
        }
        return data;
    }

    private upgradeDatabase(upgradeDB: IDBPDatabase, dbStore: IDbStore, oldVersion: number, newVersion: number, transaction: IDBPTransaction<any, StoreNames<any>[], "versionchange">) {
        const outcomes: IndexedDBActionResult<any>[] = [];
        if (oldVersion < newVersion) {
            //might not be needed
            // for (const table of upgradeDB.objectStoreNames) {
            //     if (!dbStore.stores.find(s => s.name === table)) {
            //         upgradeDB.deleteObjectStore(table);
            //         const message = `Store ${table} deleted as it was not found in the schema when upgrading from v${oldVersion} to v${newVersion}`;
            //         outcomes.push(
            //             this.getSuccessResult(message, undefined, "TableDeleted"));
            //     }
            // }

            for (var store of dbStore.stores) {

                if (!upgradeDB.objectStoreNames.contains(store.name)) {
                    outcomes.push(...this.addNewStore(upgradeDB, store, oldVersion, newVersion));
                    continue;
                }
                const table = transaction.objectStore(store.name);
                for (const indexSpec of store.indexes) {
                    if (table.indexNames.contains(indexSpec.name)) {
                        continue;
                    }
                    outcomes.push(this.createIndexForStore(indexSpec, table, oldVersion, newVersion));
                }
                //might not be needed
                // for (const dbIndexName of table.indexNames) {
                //     const dbIdxFound = store.indexes.find(i => i.name === String(dbIndexName));
                //     if(!dbIdxFound){
                //         table.deleteIndex(String(dbIndexName));
                //         const message = `Index ${String(dbIndexName)} deleted inside ${store.name} as it was not found in the schema when upgrading from v${oldVersion} to v${newVersion}`;
                //         outcomes.push(this.getSuccessResult(message, undefined, "IndexDeleted"));
                //     }
                // }
            }

        }
        return outcomes;
    }



    private async verifySchema(upgradeDB: IDBPDatabase, dbStore: IDbStore) {
        const result: IndexedDBActionResult<undefined>[] = [];
        if (dbStore.stores) {
            for (var store of dbStore.stores) {
                if (!upgradeDB.objectStoreNames.contains(store.name)) {
                    result.push(
                        this.getFailureResult(`Store ${store.name} not found in database`, "StoreNotFound"));
                    continue;
                }

                const tx = upgradeDB.transaction(store.name, "readonly");
                const table = tx.objectStore(store.name);
                for (const appIndex of store.indexes) {
                    if (!table.indexNames.contains(appIndex.name)) {
                        result.push(
                            this.getFailureResult(`Index ${appIndex.name} not found in store ${store.name}`, "IndexNotFound"));
                        continue;
                    }
                    const idx = table.index(appIndex.name);
                    if (Array.isArray(idx.keyPath)) {
                        for (const idxKey of idx.keyPath) {
                            if (!appIndex.keyPath.includes(idxKey)) {
                                result.push(
                                    this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, "IndexKeyPathMismatch"));
                            }
                        }
                    } else {
                        if (!appIndex.keyPath.includes(idx.keyPath)) {
                            result.push(
                                this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, "IndexKeyPathMismatch"));
                        }
                    }
                }
            }
        }
        return result;
    }

    private addNewStore(upgradeDB: IDBPDatabase, store: IStoreSchema, oldVersion: number, newVersion: number) {
        const storeOutcomes: IndexedDBActionResult<any>[] = []
        let primaryKey = store.primaryKey;

        if (!primaryKey) {
            primaryKey = { name: "id", keyPath: ["id"], auto: true, multiEntry: false, unique: true, keepAsArrayOnSingleValue: false };
        }
        const primaryKeyPath = primaryKey.keyPath.length == 1 ? primaryKey.keyPath[0] : primaryKey.keyPath;

        try {

            const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKeyPath, autoIncrement: primaryKey.auto });
            storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, undefined, "TableCreated"));
            for (var index of store.indexes) {
                storeOutcomes.push(this.createIndexForStore(index, newStore, oldVersion, newVersion));
            }
        }
        catch (e) {
            storeOutcomes.push(this.getFailureResult(`Error creating store ${store.name}: ${e}`, "StoreCreationError"));
        }
        return storeOutcomes;
    }



    private createIndexForStore(index: IIndexSpec, newStore: IDBPObjectStore<unknown, string[], string, "versionchange">, oldVersion: number, newVersion: number) {
        let keyPath: string | string[] = index.keyPath;
        if (index.keyPath.length === 1 && !index.keepAsArrayOnSingleValue) {
            keyPath = index.keyPath[0];
        }

        if (index.multiEntry && index.keyPath.length > 1) {
            return this.getFailureResult(`Index ${index.name} has multiEntry set to true but has multiple keyPaths. This is not supported.`, "MultiEntryIndexWithMultipleKeyPaths");
        }
        if (index.multiEntry && index.keyPath.length === 1) {
            //TODO: handle multiEntry indexes with multiple keyPaths
            keyPath = index.keyPath[0];
        }
        try {
            newStore.createIndex(index.name, keyPath, { unique: index.unique, multiEntry: index.multiEntry });
        }
        catch (e) {
            return this.getFailureResult(`Error creating index ${index.name} for store ${newStore.name}: ${e}`, "IndexCreationError");
        }
        const message = `Index ${index.name} created inside ${newStore.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
        return this.getSuccessResult(message, undefined, "IndexCreated");
    }

    private getSuccessResult<T extends any>(successMessage: string, data: T, type?: string): IndexedDBActionResultSuccess<T> {
        const result: IndexedDBActionResultSuccess<T> = {
            success: true,
            data,
            message: successMessage,
            type
        }
        console.log(result);
        return result;
    }
    private getFailureResult(errorMessage: string, type?: string): IndexedDBActionResultFailure {
        const result: IndexedDBActionResultFailure = {
            success: false,
            data: undefined,
            message: errorMessage,
            type
        }
        console.log(result);
        return result;
    }
    private async ensureDatabaseOpen(dbName: string) {
        if (!this.dbInstance) {
            this.dbInstance = await openDB(dbName);
        }
    }

}