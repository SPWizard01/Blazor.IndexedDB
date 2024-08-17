import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames, IDBPTransaction } from "idb";
import { IDbStore, IIndexSearch, IStoreRecord, IStoreSchema, DBInformation, IIndexSpec } from "./InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
import { UpgradeOutcome } from "./models/upgradeOutcome";
import { IndexedDBActionResult } from "./models/actionResult";
// import { UPGRADE_CHANNEL } from "./utils";
const RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
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

            itemToSave = this.removeKeyPropertyIfAutoIncrement(objectStore, itemToSave);
            if (!objectStore.add) {
                return this.getFailureResult("Add method not available on object store");
            }
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

    public async getRecords(storeName: string) {
        try {

            const tx = this.getTransaction(storeName, "readonly");
            const results = await tx.objectStore(storeName).getAll();
            await tx.done;
            return this.getSuccessResult(`Records retrieved from ${storeName}`, results);
        }
        catch (e) {
            return this.getFailureResult(`Error getting records from ${storeName}: ${e}`);
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

    public getRecordByIndex = async (searchData: IIndexSearch): Promise<any> => {
        const tx = this.getTransaction(searchData.storeName, "readonly");
        const objectStore = tx.objectStore(searchData.storeName);
        const index = objectStore
            .index(searchData.indexName);
       /* IDBKeyRange.*/
        const results = await index
            .get(searchData.queryValue);

        await tx.done;
        return results;
    }

    public getAllRecordsByIndex = async (searchData: IIndexSearch): Promise<any> => {
        const tx = this.getTransaction(searchData.storeName, "readonly");
        const results: any[] = [];
        // const indexToSearch = tx.objectStore(searchData.storeName)
        //     .index(searchData.indexName);
        // IDBKeyRange.bound("a", `a${("\uffff")}`)
        const recordIterator = tx.objectStore(searchData.storeName)
            .index(searchData.indexName)
            .iterate(searchData.queryValue, "next")
        for await (const cursor of recordIterator) {
            results.push(cursor.value);
        }
        await tx.done;

        return results;
    }

    public getRecordById = async (storename: string, id: any): Promise<any> => {

        const tx = this.getTransaction(storename, "readonly");

        let result = await tx.objectStore(storename).get(id);
        return result;
    }




    private getTransaction(stName: string, mode?: IDBTransactionMode) {
        const tx = this.dbInstance!.transaction(stName, mode);
        return tx;
    }

    private removeKeyPropertyIfAutoIncrement(objectStore: IDBPObjectStore<unknown, [string], string, "readonly" | "readwrite" | "versionchange">, data: any) {
        if (!objectStore.autoIncrement || !objectStore.keyPath) {
            return data;
        }

        if (!Array.isArray(objectStore.keyPath)) {
            if (data[objectStore.keyPath]) {
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

        const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKey.keyPath[0], autoIncrement: primaryKey.auto });
        storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, undefined, "TableCreated"));
        for (var index of store.indexes) {
            storeOutcomes.push(this.createIndexForStore(index, newStore, oldVersion, newVersion));
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

    private getSuccessResult(successMessage: string, data: any, type?: string): IndexedDBActionResult<any> {
        const result = {
            success: true,
            data,
            message: successMessage,
            type
        }
        console.log(result);
        return result;
    }
    private getFailureResult(errorMessage: string, type?: string): IndexedDBActionResult<any> {
        const result = {
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