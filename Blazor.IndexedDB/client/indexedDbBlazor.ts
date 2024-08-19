import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames, IDBPTransaction } from "idb";
import { IIndexedDBDatabase, IStoreSchema, DBInformation, IIndexSpec, IIndexedDBDatabaseInstance } from "./models/InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
import { IndexedDBActionResult, IndexedDBActionResultFailure, IndexedDBActionResultSuccess } from "./models/actionResult";
import { IndexedDBQueryType, IndexedDBQueryConvertion, IndexedDBIndexQuery, IndexedDBQuery } from "./models/queryValue";
import { IndexedDBRecordAction, IndexedDBObjectBase } from "./models/record";
// import { UPGRADE_CHANNEL } from "./utils";
const RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
//https://web.dev/articles/indexeddb
export class IndexedDbManager {

    private instances: IIndexedDBDatabaseInstance[] = [];
    private _dbManagerRef: DotNet.DotNetObject;
    // private upgradeChannel: BroadcastChannel; 

    constructor(dbManagerRef: DotNet.DotNetObject) {
        this._dbManagerRef = dbManagerRef;
    }


    public async openDb(dbStore: IIndexedDBDatabase) {
        const dbOpenOutcomes: IndexedDBActionResult<any>[] = [];
        let dbInstance = this.getInstance(dbStore.name);
        try {
            if (!dbInstance || dbInstance.instance.version < dbStore.version) {
                if (dbInstance) {
                    dbInstance.instance.close();
                    this.instances.splice(this.instances.indexOf(dbInstance), 1);
                    console.log(`Database ${dbInstance.name} closed`);
                }

                const instance = await openDB(dbStore.name, dbStore.version, {
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
                            let blockingInstance = this.getInstance(dbStore.name);;
                            blockingInstance?.instance.close();
                            const baseInfo: IndexedDBObjectBase = { databaseName: dbStore.name, storeName: "" };

                            dbOpenOutcomes.push(
                                this.getSuccessResult(message, undefined, baseInfo, "DatabaseUpgradeBlocking")
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
                })
                dbInstance = { name: dbStore.name, instance };
                this.instances.push(dbInstance);
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
            const result = await this.verifySchema(dbInstance.instance, dbStore);
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
            const instance = this.getInstance(dbName)!.instance;
            const dbInfo: DBInformation = {
                name: instance.name,
                version: instance.version,
                storeNames: this.getStoreNames(instance.objectStoreNames)
            };

            return this.getSuccessResult("Database information retrieved", dbInfo, { databaseName: instance.name, storeName: "" });
        }
        catch (e) {
            return this.getFailureResult(`Error getting database information: ${e}`);
        }
    }


    public async deleteDb(databaseName: string) {
        try {
            const db = this.getInstance(databaseName);
            db?.instance.close();

            await deleteDB(databaseName);
            if (db) {
                this.instances.splice(this.instances.indexOf(db), 1);
            }
            const msg = `The database ${databaseName} has been deleted.`;
            return this.getSuccessResult(msg, undefined, { databaseName, storeName: "" });
        }
        catch (e) {
            return this.getFailureResult(`Error deleting database: ${e}`);
        }
    }
    //#region CRUD
    public async addRecord(record: IndexedDBRecordAction) {
        let itemToSave = record.data;
        try {
            const { tx, objectStore, idbKeyResult } = this.getStoreQuery(record, "readwrite");
            itemToSave = this.removePrimaryKeyPropertyIfAutoIncrement(objectStore, itemToSave);
            if (!objectStore.add) {
                return this.getFailureResult("Add method not available on object store");
            }
            let key: IDBValidKey | IDBKeyRange | undefined = undefined;
            if (!idbKeyResult.success && record.useKey) {
                return this.getFailureResult("Unable to update record, key not valid");
            }
            if (idbKeyResult.success && record.useKey) {
                key = idbKeyResult.result.data.value;
            }

            const result = await objectStore.add(itemToSave, key);
            const dbResult = await objectStore.get(result!);
            await tx.done;
            const msg = `Added new record with id ${result}`;
            return this.getSuccessResult(msg, dbResult, record);
        }
        catch (e) {
            return this.getFailureResult(`Error adding record: ${e}`);
        }

    }

    public async updateRecord(record: IndexedDBRecordAction) {
        try {
            const { tx, idbKeyResult, objectStore } = this.getStoreQuery(record, "readwrite");
            if (!objectStore.put) {
                return this.getFailureResult("Put method not available on object store");
            }
            let key: IDBValidKey | IDBKeyRange | undefined = undefined;
            if (!idbKeyResult.success && record.useKey) {
                return this.getFailureResult("Unable to update record, key not valid");
            }
            if (idbKeyResult.success && record.useKey) {
                key = idbKeyResult.result.data.value;
            }

            const result = await objectStore.put(record.data, key);
            const dbResult = await objectStore.get(result);
            await tx.done;
            const msg = `Updated record with id ${result}`;
            return this.getSuccessResult(msg, dbResult, record);

        }
        catch (e) {
            return this.getFailureResult(`Error updating record: ${e}`);
        }
    }

    public async deleteRecordByQuery(query: IndexedDBQuery) {


        try {
            const { tx, objectStore, idbKeyResult } = this.getStoreQuery(query, "readwrite");
            if (!objectStore.delete) {
                return this.getFailureResult("delete method not available on object store");
            }
            if (!idbKeyResult.success) {
                return this.getFailureResult(`Error deleting record: ${idbKeyResult.message}`);
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`Error deleting record: NoQuery is not a valid query`);
            }
            await objectStore.delete(idbKeyResult.result.data.value);
            await tx.done;
            return this.getSuccessResult(`Deleted records from store ${query.storeName}`, undefined, query);
        }
        catch (e) {
            return this.getFailureResult(`Error deleting record: ${e}`);
        }
    }

    public async deleteRecordByKey(record: IndexedDBQuery) {

        try {
            if (!record.queryValue) {
                return this.getFailureResult("Key is required to delete record");
            }
            const { tx, idbKeyResult, objectStore } = this.getStoreQuery(record, "readwrite");
            if (!objectStore.put) {
                return this.getFailureResult("Put method not available on object store");
            }
            if (!idbKeyResult.success) {
                return this.getFailureResult("Unable to delete record, key not valid");
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`Error deleting record: NoQuery is not a valid query`);
            }
            if (!objectStore.delete) {
                return this.getFailureResult("delete method not available on object store");
            }
            await objectStore.delete(idbKeyResult.result.data.value);
            await tx.done;
            return this.getSuccessResult(`Deleted record(s) from store ${record.storeName}`, undefined, record);
        }
        catch (e) {
            return this.getFailureResult(`Error deleting record: ${e}`);
        }
    }

    public async clearStore(record: IndexedDBObjectBase) {

        try {
            const tx = this.getTransaction(record, "readwrite");
            await tx.objectStore(record.storeName).clear?.();
            await tx.done;
            return this.getSuccessResult(`Store ${record.storeName} cleared`, undefined, record);
        }
        catch (e) {
            return this.getFailureResult(`Error clearing store ${record.storeName}: ${e}`);
        }
    }

    //#endregion

    //#region IndexQueries
    public async iterateRecordsByIndex(searchData: IndexedDBIndexQuery, direction: IDBCursorDirection) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results: any[] = [];
            const recordIterator = index.iterate(idbKeyResult.result.data.value, direction);
            for await (const cursor of recordIterator) {
                results.push(cursor.value);
            }
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getRecordByIndex(searchData: IndexedDBIndexQuery) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`);
            }
            const results = await index.get(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllRecordsByIndexQuery(searchData: IndexedDBIndexQuery, count: number) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAll(idbKeyResult.result.data.value, count !== -1 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllRecordsByIndex(searchData: IndexedDBIndexQuery) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAll()
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getAllKeysByIndex(searchData: IndexedDBIndexQuery, count: number) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await index.getAllKeys(idbKeyResult.result.data.value, count !== -1 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }

    public async getKeyByIndex(searchData: IndexedDBIndexQuery) {
        try {
            const { index, tx, idbKeyResult } = this.getIndexQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`);
            }
            const results = await index.getKey(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
        }
    }
    //#endregion

    //#region StoreRecordQueries
    public async iterateRecords(searchData: IndexedDBQuery, direction?: IDBCursorDirection) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results: any[] = [];
            const recordIterator = objectStore.iterate(idbKeyResult.result.data.value, direction);
            for await (const cursor of recordIterator) {
                results.push(cursor.value);
            }
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getRecord(searchData: IndexedDBQuery) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`);
            }
            const results = await objectStore.get(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from table ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records table ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllRecords(searchData: IndexedDBQuery) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAll()
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllRecordsByQuery(searchData: IndexedDBQuery, count: number) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAll(idbKeyResult.result.data.value, count !== -1 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getAllKeys(searchData: IndexedDBQuery, count: number) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results = await objectStore.getAllKeys(idbKeyResult.result.data.value, count !== -1 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }

    public async getKey(searchData: IndexedDBQuery) {
        try {
            const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`);
            }
            const results = await objectStore.getKey(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results, searchData);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
        }
    }
    //#endregion


    private getIDBKey(incommingQuery: IndexedDBQuery) {
        let result: IndexedDBQueryConvertion | undefined;
        const query = incommingQuery.queryValue;
        switch (query.queryType) {
            case "BoundQuery":
                result = { type: "KeyRange", value: IDBKeyRange.bound(query.lower, query.upper, query.lowerOpen, query.upperOpen) };

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
            case "NoQuery":
                result = { type: "NoQuery", value: undefined };
                break;
            default:
                return this.getFailureResult(`Invalid query type ${(query as any).queryType}`);
        }
        return this.getSuccessResult("IDBKey created", result, incommingQuery);
    }


    private getIndexQuery(searchData: IndexedDBIndexQuery, transactionMode: IDBTransactionMode) {
        const { objectStore, tx, idbKeyResult } = this.getStoreQuery(searchData, transactionMode);
        const index = objectStore.index(searchData.indexName);
        return { index, tx, idbKeyResult, objectStore };
    }

    private getStoreQuery(searchData: IndexedDBQuery, transactionMode: IDBTransactionMode) {
        const tx = this.getTransaction(searchData, transactionMode);
        const objectStore = tx.objectStore(searchData.storeName);
        const idbKeyResult = this.getIDBKey(searchData);
        return { objectStore, tx, idbKeyResult };
    }

    private getTransaction(searchData: IndexedDBObjectBase, mode: IDBTransactionMode) {
        const db = this.getInstance(searchData.databaseName);
        const tx = db!.instance.transaction(searchData.storeName, mode);
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

    private upgradeDatabase(upgradeDB: IDBPDatabase, dbStore: IIndexedDBDatabase, oldVersion: number, newVersion: number, transaction: IDBPTransaction<any, StoreNames<any>[], "versionchange">) {
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



    private async verifySchema(upgradeDB: IDBPDatabase, dbStore: IIndexedDBDatabase) {
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
            const baseInfo: IndexedDBObjectBase = { databaseName: upgradeDB.name, storeName: store.name };
            storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, undefined, baseInfo, "TableCreated"));
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
        return this.getSuccessResult(message, undefined, { databaseName: "", storeName: newStore.name }, "IndexCreated");
    }

    private getSuccessResult<T extends any>(successMessage: string, data: T, requestBase: IndexedDBObjectBase, type?: string): IndexedDBActionResultSuccess<T> {
        const result: IndexedDBActionResultSuccess<T> = {
            success: true,
            result: {
                data,
                databaseName: requestBase.databaseName,
                storeName: requestBase.storeName
            },
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

    private getInstance(dbName: string) {
        return this.instances.find(i => i.name.toLowerCase() === dbName.toLowerCase())
    }
    // private async ensureDatabaseOpen(dbName: string) {
    //     let dbInstance = this.instances.find(i => i.name === dbName);
    //     if (!dbInstance) {
    //         dbInstance = {
    //             name: dbName,
    //             instance: await openDB(dbName)
    //         }
    //         this.instances.push(dbInstance);
    //     }
    //     return dbInstance.instance;
    // }

}