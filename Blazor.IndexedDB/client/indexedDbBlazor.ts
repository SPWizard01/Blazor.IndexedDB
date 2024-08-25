import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames, IDBPTransaction } from "idb";
import { IIndexedDBDatabase, IStoreSchema, DBInformation, IIndexSpec, IIndexedDBDatabaseInstance, IndexedDBCursorQuery, IndexedDBJSConfig } from "./models/InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
import { IndexedDBActionResult, IndexedDBActionResultFailure, IndexedDBActionResultSuccess, IndexedDBActionResultType } from "./models/actionResult";
import { IndexedDBQueryType, IndexedDBQueryConvertion, IndexedDBQuery } from "./models/queryValue";
import { IndexedDBRecordAction, IndexedDBObjectBase } from "./models/record";
// import { UPGRADE_CHANNEL } from "./utils";
const RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
//https://web.dev/articles/indexeddb
export class IndexedDbManager {

    private instances: IIndexedDBDatabaseInstance[] = [];
    private _dbManagerRef: DotNet.DotNetObject;
    private _sendNotifications = false;

    constructor(instanceConfig: IndexedDBJSConfig) {
        this._dbManagerRef = instanceConfig.dotNetReference;
        this._sendNotifications = instanceConfig.sendNotificationsFromJS;
    }


    public async openDb(indexedDatabase: IIndexedDBDatabase) {
        const dbOpenOutcomes: IndexedDBActionResult<any>[] = [];
        let dbInstance = this.getInstance(indexedDatabase.name);
        try {
            if (!dbInstance || dbInstance.instance.version < indexedDatabase.version) {
                if (dbInstance) {
                    dbInstance.instance.close();
                    this.instances.splice(this.instances.indexOf(dbInstance), 1);
                }

                const instance = await openDB(indexedDatabase.name, indexedDatabase.version, {
                    upgrade: async (database, oldVersion, newVersion, transaction) => {

                        const outcomes = this.upgradeDatabase(database, indexedDatabase, oldVersion, newVersion!, transaction);
                        await transaction.done;
                        dbOpenOutcomes.push(...outcomes);
                    },
                    blocked: async (currentVersion, blockedVersion, event) => {
                        const message = `Database upgrade blocked. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
                        console.warn(message, event);
                        dbOpenOutcomes.push(
                            this.getFailureResult(message, { databaseName: indexedDatabase.name, storeName: "" }, "DatabaseUpgradeBlocked"));
                    },
                    blocking: async (currentVersion, blockedVersion, event) => {
                        const message = `Database upgrade blocking. Current version: ${currentVersion}, Blocked version: ${blockedVersion}, trying to close db.`;
                        console.warn(message, event);
                        try {
                            let blockingInstance = this.getInstance(indexedDatabase.name);;
                            blockingInstance?.instance.close();
                            const baseInfo: IndexedDBObjectBase = { databaseName: indexedDatabase.name, storeName: "" };

                            dbOpenOutcomes.push(
                                this.getSuccessResult(message, undefined, baseInfo, "DatabaseUpgradeBlocking")
                            );
                        }
                        catch (e) {
                            const message = `Could not close db, will try again. ${e}`;
                            console.error(message);
                            dbOpenOutcomes.push(
                                this.getFailureResult(message, { databaseName: indexedDatabase.name, storeName: "" }, "DatabaseUpgradeBlocking")
                            );
                        }
                    }
                })
                dbInstance = { name: indexedDatabase.name, instance, executingCursors: [] };
                this.instances.push(dbInstance);
            }
        } catch (e) {
            dbOpenOutcomes.push(
                this.getFailureResult(`Could not open db ${e}`, { databaseName: indexedDatabase.name, storeName: "" }, "DatabaseOpenError")
            );
            return dbOpenOutcomes;
        }
        try {
            const result = await this.verifySchema(dbInstance.instance, indexedDatabase);
            dbOpenOutcomes.push(...result);

        }
        catch (e) {
            dbOpenOutcomes.push(
                this.getFailureResult(`Could not verify schema ${e}`, { databaseName: indexedDatabase.name, storeName: "" }, "SchemaVerificationError")
            );
        }
        if (!dbOpenOutcomes.some(o => !o.success)) {
            dbOpenOutcomes.push(this.getSuccessResult(`Database ${indexedDatabase.name} opened`, undefined, { databaseName: indexedDatabase.name, storeName: "" }, "DatabaseOpened"));
        }
        return dbOpenOutcomes;
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
            return this.getSuccessResult(msg, undefined, { databaseName, storeName: "" }, "DatabaseDeleted");
        }
        catch (e) {
            return this.getFailureResult(`Error deleting database: ${e}`, { databaseName, storeName: "" }, "DatabaseDeleteError");
        }
    }

    public async getDatabaseInfo(databaseName: string) {
        try {
            const instance = this.getInstance(databaseName)!.instance;
            const dbInfo: DBInformation = {
                name: instance.name,
                version: instance.version,
                storeNames: this.getStoreNames(instance.objectStoreNames)
            };

            return this.getSuccessResult("Database information retrieved", dbInfo, { databaseName: instance.name, storeName: "" }, "DatabaseInfo");
        }
        catch (e) {
            return this.getFailureResult(`Error getting database information: ${e}`, { databaseName, storeName: "" }, "DatabaseInfoError");
        }
    }

    //#region CRUD
    public async addRecord(record: IndexedDBRecordAction) {
        let itemToSave = record.data;
        try {
            const { tx, objectStore, idbKeyResult } = this.getStoreQuery(record, "readwrite");
            itemToSave = this.removePrimaryKeyPropertyIfAutoIncrement(objectStore, itemToSave);
            if (!objectStore.add) {
                return this.getFailureResult("Add method not available on object store", record, "RecordQueryError");
            }
            let key: IDBValidKey | IDBKeyRange | undefined = undefined;
            if (!idbKeyResult.success && record.useKey) {
                return this.getFailureResult("Unable to update record, key not valid", record, "RecordQueryError");
            }
            if (idbKeyResult.success && record.useKey) {
                key = idbKeyResult.result.data.value;
            }

            const result = await objectStore.add(itemToSave, key);
            const dbResult = await objectStore.get(result);
            await tx.done;
            const msg = `Added new record with id ${result}`;
            return this.getSuccessResult(msg, dbResult, record, "Record");
        }
        catch (e) {
            return this.getFailureResult(`Error adding record: ${e}`, record, "RecordQueryError");
        }

    }

    public async updateRecord(record: IndexedDBRecordAction) {
        try {
            const { tx, idbKeyResult, objectStore } = this.getStoreQuery(record, "readwrite");
            if (!objectStore.put) {
                return this.getFailureResult("Put method not available on object store", record, "RecordQueryError");
            }
            let key: IDBValidKey | IDBKeyRange | undefined = undefined;
            if (!idbKeyResult.success && record.useKey) {
                return this.getFailureResult("Unable to update record, key not valid", record, "RecordQueryError");
            }
            if (idbKeyResult.success && record.useKey) {
                key = idbKeyResult.result.data.value;
            }

            const result = await objectStore.put(record.data, key);
            const dbResult = await objectStore.get(result);
            await tx.done;
            const msg = `Updated record with id ${result}`;
            return this.getSuccessResult(msg, dbResult, record, "Record");

        }
        catch (e) {
            return this.getFailureResult(`Error updating record: ${e}`, record, "RecordQueryError");
        }
    }

    public async deleteRecord(query: IndexedDBQuery) {
        try {
            const { tx, objectStore, idbKeyResult } = this.getStoreQuery(query, "readwrite");
            if (!objectStore.delete) {
                return this.getFailureResult("delete method not available on object store", query, "RecordQueryError");
            }
            if (!idbKeyResult.success) {
                return this.getFailureResult(`Error deleting record: ${idbKeyResult.message}`, query, "RecordQueryError");
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`Error deleting record: NoQuery is not a valid query`, query, "RecordQueryError");
            }
            await objectStore.delete(idbKeyResult.result.data.value);
            await tx.done;
            return this.getSuccessResult(`Deleted records from store ${query.storeName}`, undefined, query, "RecordDeleted");
        }
        catch (e) {
            return this.getFailureResult(`Error deleting record: ${e}`, query, "RecordQueryError");
        }
    }

    public async clearStore(record: IndexedDBObjectBase) {

        try {
            const { tx, objectStore } = this.getTransaction(record, "readwrite");
            if (!objectStore.clear) {
                return this.getFailureResult("Clear method not available on object store", record, "StoreQueryError");
            }
            await objectStore.clear();
            await tx.done;
            return this.getSuccessResult(`Store ${record.storeName} cleared`, undefined, record, "StoreCleared");
        }
        catch (e) {
            return this.getFailureResult(`Error clearing store ${record.storeName}: ${e}`, record, "StoreQueryError");
        }
    }

    //#endregion

    //#region StoreRecordQueries

    public async openCursor(searchData: IndexedDBQuery, direction?: IDBCursorDirection) {
        try {
            const queryPath = this.getQueryPath(searchData)
            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const instance = this.getInstance(searchData.databaseName)!;
            const executingCursor = this.getInstanceExecutingCursor(instance, searchData);
            if (executingCursor) {
                return this.getFailureResult(`Another cursor is already open`, searchData, "CursorFailure");
            }
            const query = idbKeyResult.result.data.value;
            const queryObject = index ?? objectStore;
            const rs = await queryObject.openCursor(query, direction);
            await tx.done;
            if (rs?.value) {
                instance.executingCursors.push({ initialQuery: searchData, cursorPosition: 1, direction });
                return this.getSuccessResult(`Cursor result ${queryPath}`, rs.value, searchData, "CursorRecord");

            }
            return this.getSuccessResult(`Cursor result ${queryPath}`, undefined, searchData, "CursorClosed");
        }
        catch (e) {
            return this.getFailureResult(`Error getting records ${e}`, searchData, "CursorFailure");
        }
    }

    public async advanceCursor(searchData: IndexedDBQuery) {
        try {
            const queryPath = this.getQueryPath(searchData)
            const instance = this.getInstance(searchData.databaseName)!;
            const executingCursor = this.getInstanceExecutingCursor(instance, searchData);
            if (executingCursor) {
                const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(executingCursor.initialQuery, "readonly");
                if (!idbKeyResult.success) {
                    return idbKeyResult
                }
                const query = idbKeyResult.result.data.value;
                const queryObject = index ?? objectStore;
                const rs = await queryObject.openCursor(query, executingCursor.direction);
                const next = await rs?.advance(executingCursor.cursorPosition);
                await tx.done;
                if (!next || !next.value) {
                    instance.executingCursors.splice(instance.executingCursors.indexOf(executingCursor), 1);
                    return this.getSuccessResult(`No more records ${queryPath}`, undefined, searchData, "CursorClosed");
                }
                executingCursor.cursorPosition += 1;
                return this.getSuccessResult(`Cursor record ${queryPath}`, next.value, searchData, "CursorRecord");

            }
            return this.getSuccessResult(`No cursor is open ${queryPath}`, undefined, searchData, "CursorNotOpen");

        }
        catch (e) {
            return this.getFailureResult(`Error getting records ${e}`, searchData, "CursorFailure");
        }
    }
    public async closeCursor(searchData: IndexedDBQuery) {
        try {
            const instance = this.getInstance(searchData.databaseName)!;
            const executingCursor = this.getInstanceExecutingCursor(instance, searchData);

            if (!executingCursor) {
                return this.getSuccessResult(`No cursor is open`, undefined, searchData, "CursorNotOpen");
            }
            instance.executingCursors.splice(instance.executingCursors.indexOf(executingCursor), 1);
            return this.getSuccessResult(``, undefined, searchData, "CursorClosed");
        }
        catch (e) {
            return this.getFailureResult(`Error closing cursor: ${e}`, searchData, "CursorFailure");
        }
    }

    public async closeAllStoreCursors(searchData: IndexedDBObjectBase) {
        try {
            const instance = this.getInstance(searchData.databaseName)!;
            instance.executingCursors = instance.executingCursors.filter(c =>
                c.initialQuery.databaseName !== searchData.databaseName &&
                c.initialQuery.storeName !== searchData.storeName
            );
            return this.getSuccessResult(``, undefined, searchData, "CursorNoMoreRecords");
        }
        catch (e) {
            return this.getFailureResult(`Error closing cursor: ${e}`, searchData, "CursorFailure");
        }
    }
    public async closeAllCursors(searchData: IndexedDBObjectBase) {
        try {
            const instance = this.getInstance(searchData.databaseName)!;
            instance.executingCursors = [];
            return this.getSuccessResult(``, undefined, { databaseName: searchData.databaseName, storeName: "" }, "CursorClosed");
        }
        catch (e) {
            return this.getFailureResult(`Error closing cursor: ${e}`, { databaseName: searchData.databaseName, storeName: "" }, "CursorFailure");
        }
    }

    public async iterateRecords(searchData: IndexedDBQuery, direction?: IDBCursorDirection) {
        try {
            const queryPath = this.getQueryPath(searchData)

            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const results: any[] = [];
            const queryObject = index ?? objectStore;
            const recordIterator = queryObject.iterate(idbKeyResult.result.data.value, direction);
            for await (const cursor of recordIterator) {
                results.push(cursor.value);
            }
            await tx.done;
            return this.getSuccessResult(`${results.length} records retrieved ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
        }
        catch (e) {
            return this.getFailureResult(`Error getting records ${e}`, searchData, "StoreQueryError");
        }
    }

    public async getRecord(searchData: IndexedDBQuery) {
        try {
            const queryPath = this.getQueryPath(searchData)
            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`, searchData, "RecordQueryError");
            }
            const queryObject = index ?? objectStore;
            const results = await queryObject.get(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`${results ? "1" : "0"} record retrieved ${queryPath}`, results, searchData, results ? "Record" : "RecordNotFound");
        }
        catch (e) {
            return this.getFailureResult(`Error getting record: ${e}`, searchData, "StoreQueryError");
        }
    }

    public async getAllRecords(searchData: IndexedDBQuery, count: number) {
        try {
            const queryPath = this.getQueryPath(searchData)
            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const queryObject = index ?? objectStore;
            const results = await queryObject.getAll(idbKeyResult.result.data.value, count > 0 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`${results.length} records retrieved from ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
        }
        catch (e) {
            return this.getFailureResult(`Error getting records: ${e}`, searchData, "StoreQueryError");
        }
    }

    public async getAllKeys(searchData: IndexedDBQuery, count: number) {
        try {
            const queryPath = this.getQueryPath(searchData)
            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            const queryObject = index ?? objectStore;
            const results = await queryObject.getAllKeys(idbKeyResult.result.data.value, count > 0 ? count : undefined)
            await tx.done;
            return this.getSuccessResult(`${results.length} keys retrieved from ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
        }
        catch (e) {
            return this.getFailureResult(`Error getting keys: ${e}`, searchData, "StoreQueryError");
        }
    }

    public async getKey(searchData: IndexedDBQuery) {
        try {
            const queryPath = this.getQueryPath(searchData)

            const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
            if (!idbKeyResult.success) {
                return idbKeyResult
            }
            if (idbKeyResult.result.data.type === "NoQuery") {
                return this.getFailureResult(`NoQuery is not a valid query`, searchData, "RecordQueryError");
            }
            const queryObject = index ?? objectStore;
            const results = await queryObject.getKey(idbKeyResult.result.data.value)
            await tx.done;
            return this.getSuccessResult(`${results ? "1" : "0"} keys retrieved from ${queryPath}`, results, searchData, results ? "Record" : "RecordNotFound");
        }
        catch (e) {
            return this.getFailureResult(`Error getting keys: ${e}`, searchData, "StoreQueryError");
        }
    }
    //#endregion

    private getIDBKey(incommingQuery: IndexedDBQuery) {
        let result: IndexedDBQueryConvertion | undefined;
        const query = incommingQuery.queryValue;
        try {
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
                    return this.getFailureResult(`Invalid query type ${(query as any).queryType}`, incommingQuery, "IDBKeyFailure");
            }
        }
        catch (e) {
            return this.getFailureResult(`Failed to create key ${e}`, incommingQuery, "IDBKeyFailure");
        }
        return this.getSuccessResult("", result, incommingQuery, "IDBKeyCreated");
    }

    private getStoreQuery(searchData: IndexedDBQuery, transactionMode: IDBTransactionMode) {
        const { tx, objectStore } = this.getTransaction(searchData, transactionMode);
        const idbKeyResult = this.getIDBKey(searchData);
        const index = searchData.indexName ? objectStore.index(searchData.indexName) : undefined;
        return { objectStore, tx, idbKeyResult, index };
    }

    private getTransaction(searchData: IndexedDBObjectBase, mode: IDBTransactionMode) {
        const db = this.getInstance(searchData.databaseName);
        const tx = db!.instance.transaction(searchData.storeName, mode);
        const objectStore = tx.objectStore(searchData.storeName);
        return { tx, objectStore };
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

    private async verifySchema(upgradeDB: IDBPDatabase, database: IIndexedDBDatabase) {
        const result: IndexedDBActionResult<undefined>[] = [];
        if (database.stores) {
            for (var store of database.stores) {
                const processingObject = { databaseName: database.name, storeName: store.name };
                if (!upgradeDB.objectStoreNames.contains(store.name)) {
                    result.push(
                        this.getFailureResult(`Store ${store.name} not found in database`, processingObject, "StoreNotFound"));
                    continue;
                }

                const tx = upgradeDB.transaction(store.name, "readonly");
                const table = tx.objectStore(store.name);
                for (const appIndex of store.indexes) {
                    if (!table.indexNames.contains(appIndex.name)) {
                        result.push(
                            this.getFailureResult(`Index ${appIndex.name} not found in store ${store.name}`, processingObject, "IndexNotFound"));
                        continue;
                    }
                    const idx = table.index(appIndex.name);
                    if (Array.isArray(idx.keyPath)) {
                        for (const idxKey of idx.keyPath) {
                            if (!appIndex.keyPath.includes(idxKey)) {
                                result.push(
                                    this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, processingObject, "IndexKeyPathMismatch"));
                            }
                        }
                    } else {
                        if (!appIndex.keyPath.includes(idx.keyPath)) {
                            result.push(
                                this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, processingObject, "IndexKeyPathMismatch"));
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
            storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, undefined, baseInfo, "StoreCreated"));
            for (var index of store.indexes) {
                storeOutcomes.push(this.createIndexForStore(index, newStore, oldVersion, newVersion));
            }
        }
        catch (e) {
            storeOutcomes.push(this.getFailureResult(`Error creating store ${store.name}: ${e}`, { databaseName: upgradeDB.name, storeName: store.name }, "StoreCreationError"));
        }
        return storeOutcomes;
    }

    private createIndexForStore(index: IIndexSpec, newStore: IDBPObjectStore<unknown, string[], string, "versionchange">, oldVersion: number, newVersion: number) {
        let keyPath: string | string[] = index.keyPath;
        if (index.keyPath.length === 1 && !index.keepAsArrayOnSingleValue) {
            keyPath = index.keyPath[0];
        }

        if (index.multiEntry && index.keyPath.length > 1) {
            return this.getFailureResult(`Index ${index.name} has multiEntry set to true but has multiple keyPaths. This is not supported.`, { databaseName: newStore.transaction.db.name, storeName: newStore.name }, "MultiEntryIndexWithMultipleKeyPaths");
        }
        if (index.multiEntry && index.keyPath.length === 1) {
            //TODO: handle multiEntry indexes with multiple keyPaths
            keyPath = index.keyPath[0];
        }
        try {
            newStore.createIndex(index.name, keyPath, { unique: index.unique, multiEntry: index.multiEntry });
        }
        catch (e) {
            return this.getFailureResult(`Error creating index ${index.name} for store ${newStore.name}: ${e}`, { databaseName: newStore.transaction.db.name, storeName: newStore.name }, "IndexCreationError");
        }
        const message = `Index ${index.name} created inside ${newStore.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
        return this.getSuccessResult(message, undefined, { databaseName: "", storeName: newStore.name }, "IndexCreated");
    }

    private getSuccessResult<T extends any>(successMessage: string, data: T, requestBase: IndexedDBObjectBase, type: IndexedDBActionResultType): IndexedDBActionResultSuccess<T> {
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
        if (this._sendNotifications) {
            this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, result)
            if (DEBUG) {
                console.log(result);
            }
        }
        return result;
    }
    private getFailureResult(errorMessage: string, requestBase: IndexedDBObjectBase, type: IndexedDBActionResultType): IndexedDBActionResultFailure {
        const result: IndexedDBActionResultFailure = {
            success: false,
            result: {
                data: undefined,
                databaseName: requestBase.databaseName,
                storeName: requestBase.storeName
            },
            message: errorMessage,
            type
        }
        if (this._sendNotifications) {
            this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, result)
            if (DEBUG) {
                console.log(result);
            }
        }
        return result;
    }

    private getInstance(dbName: string) {
        return this.instances.find(i => i.name.toLowerCase() === dbName.toLowerCase())
    }

    private getInstanceExecutingCursor(instance: IIndexedDBDatabaseInstance, searchData: IndexedDBQuery) {
        return instance.executingCursors.find(c =>
            c.initialQuery.databaseName === searchData.databaseName &&
            c.initialQuery.storeName === searchData.storeName &&
            c.initialQuery.indexName === searchData.indexName &&
            //Might not be the best idea or needed at all
            JSON.stringify(c.initialQuery.queryValue) === JSON.stringify(searchData.queryValue)
        );
    }

    private getQueryPath(searchData: IndexedDBQuery) {
        return `${searchData.databaseName}->${searchData.storeName}${searchData.indexName ? `->${searchData.indexName}` : ``}`;
    }

    private getStoreNames(list: TypedDOMStringList<StoreNames<any>>) {
        const names: string[] = [];
        for (const storeName of list) {
            names.push(storeName);
        }
        return names;
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