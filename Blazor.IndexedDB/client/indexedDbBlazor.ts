import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames, IDBPTransaction } from "idb";
import { IDbStore, IIndexSearch, IStoreRecord, IStoreSchema, DBInformation } from "./InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
import { RecordActionResult } from "./models/recordActionResult";
import { UpgradeOutcome } from "./models/upgradeOutcome";
// import { UPGRADE_CHANNEL } from "./utils";
const RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
export class IndexedDbManager {

    private dbInstance: IDBPDatabase | undefined;
    private _dbManagerRef: DotNet.DotNetObject;
    // private upgradeChannel: BroadcastChannel; 

    constructor(dbManagerRef: DotNet.DotNetObject) {
        this._dbManagerRef = dbManagerRef;
        // this.upgradeChannel = new BroadcastChannel(UPGRADE_CHANNEL);
        // this.upgradeChannel.addEventListener("message", this.upgradeChannelMessageHandler)
    }

    private upgradeChannelMessageHandler = (ev: MessageEvent) => {
        console.log("Upgrade message received.");
        if (this.dbInstance) {
            this.dbInstance?.close();
        }
    }

    public async openDb(data: IDbStore) {
        const dbStore = data;
        try {
            if (!this.dbInstance || this.dbInstance.version < dbStore.version) {
                if (this.dbInstance) {
                    this.dbInstance.close();
                }
                this.dbInstance = await openDB(dbStore.dbName, dbStore.version, {
                    upgrade: async (database, oldVersion, newVersion, transaction) => {
                        
                        const outcomes = this.upgradeDatabase(database, dbStore, oldVersion, newVersion!, transaction);
                        for (const element of outcomes) {
                            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, element.type, element.message);
                        }

                    },
                    blocked: async (currentVersion, blockedVersion, event) => {
                        const msg = `Database upgrade blocked. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
                        console.warn(msg, event);
                        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseUpgradeBlocked", msg)

                    },
                    blocking: async (currentVersion, blockedVersion, event) => {
                        const msg = `Database upgrade blocking. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
                        console.warn(msg, event);
                        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseUpgradeBlocking", msg)
                        this.dbInstance?.close();
                    }
                });
            }
        } catch (e) {
            const msg = `Could not open db, will try again. ${e}`;
            console.error(msg);
            this.dbInstance = await openDB(dbStore.dbName);
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseOpenFailure", msg)

        }
        const result = await this.verifySchema(this.dbInstance, dbStore);
        if (result.success === false) {
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "SchemaVerificationFailure", result.message)
        }
        const msg = `IndexedDB ${data.dbName} opened`;
        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseOpened", msg)
        return msg;
    }

    private getStoreNames(list: TypedDOMStringList<StoreNames<any>>) {
        const names: string[] = [];
        for (const storeName of list) {
            names.push(storeName);
        }
        return names;
    }

    public async getDbInfo(dbName: string) {
        if (!this.dbInstance) {
            this.dbInstance = await openDB(dbName);
        }

        const currentDb = <IDBPDatabase>this.dbInstance;

        const dbInfo: DBInformation = {
            name: currentDb.name,
            version: currentDb.version,
            storeNames: this.getStoreNames(currentDb.objectStoreNames)
        };

        return dbInfo;
    }

    public async deleteDb(dbName: string): Promise<string> {
        this.dbInstance?.close();

        await deleteDB(dbName);

        this.dbInstance = undefined;
        const msg = `The database ${dbName} has been deleted.`;
        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseDeleted", msg)

        return msg;
    }

    public async addRecord(record: IStoreRecord) {
        const stName = record.storeName;
        let itemToSave = record.data;
        const tx = this.getTransaction(stName, "readwrite");
        const objectStore = tx.objectStore(stName);

        itemToSave = this.removeKeyProperty(objectStore, itemToSave);

        try {
            if (!objectStore.add) {
                throw new Error("Add method not available on object store");
            }
            const result = await objectStore.add(itemToSave);
            const dbResult = await objectStore.get(result!);
            await tx.done;
            const msg = `Added new record with id ${result}`;
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordAdded", msg);
            const addResult: RecordActionResult = {
                storeName: record.storeName,
                key: result as any,
                data: dbResult
            }
            return addResult;
        }
        catch (e) {
            const msg = `Error adding record: ${e}`;
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordAddFailure", msg);
            throw msg;
        }

    }

    public async updateRecord(record: IStoreRecord) {
        const stName = record.storeName;
        const tx = this.getTransaction(stName, "readwrite");
        const objectStore = tx.objectStore(stName);
        try {
            if (!objectStore.put) {
                throw new Error("Put method not available on object store");
            }
            const result = await objectStore.put(record.data, record.key);
            const dbResult = await objectStore.get(result);
            await tx.done;
            const addResult: RecordActionResult = {
                storeName: record.storeName,
                key: result as any,
                data: dbResult
            }
            const msg = `Updated record with id ${result}`;
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordUpdated", msg);

            return addResult;
        }
        catch (e) {
            const msg = `Error updating record: ${e}`;
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordUpdateFailure", msg);
            throw msg;
        }
    }

    public async deleteRecord(record: IStoreRecord) {
        if (!record.key) {
            throw new Error("Record key is required to delete a record");
        }
        const stName = record.storeName;
        const tx = this.getTransaction(stName, "readwrite");
        const objectStore = tx.objectStore(stName);
        debugger;
        try {
            if (!objectStore.delete) {
                throw new Error("delete method not available on object store");
            }
            await objectStore.delete(record.key);
            await tx.done;
            return await this.notifyRecordDeleted(record.key, stName);
        }
        catch (e) {
            await this.notifyDeleteFailure(e);
        }
    }

    public async deleteRecordByKey(storename: string, id: any) {
        const tx = this.getTransaction(storename, "readwrite");
        const objectStore = tx.objectStore(storename);
        try {
            if (!objectStore.delete) {
                throw new Error("delete method not available on object store");
            }
            await objectStore.delete(id);
            return await this.notifyRecordDeleted(id, storename);
        }
        catch (e) {
            await this.notifyDeleteFailure(e);
        }
    }


    public getRecords = async (storeName: string): Promise<any> => {
        const tx = this.getTransaction(storeName, "readonly");

        let results = await tx.objectStore(storeName).getAll();

        await tx.done;

        return results;
    }



    public clearStore = async (storeName: string): Promise<string> => {

        const tx = this.getTransaction(storeName, "readwrite");

        await tx.objectStore(storeName).clear?.();
        await tx.done;

        return `Store ${storeName} cleared`;
    }

    public getRecordByIndex = async (searchData: IIndexSearch): Promise<any> => {
        const tx = this.getTransaction(searchData.storeName, "readonly");
        const results = await tx.objectStore(searchData.storeName)
            .index(searchData.indexName)
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
        console.log(recordIterator);

        return results;
    }

    public getRecordById = async (storename: string, id: any): Promise<any> => {

        const tx = this.getTransaction(storename, "readonly");

        let result = await tx.objectStore(storename).get(id);
        return result;
    }


    private async notifyDeleteFailure(e: unknown) {
        const msg = `Error deleting record: ${e}`;
        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordDeleteFailure", msg);
        throw msg;
    }

    private getTransaction(stName: string, mode?: IDBTransactionMode) {
        const tx = this.dbInstance!.transaction(stName, mode);
        //tx.done.catch(
        //    err => {
        //        if (err) {
        //            console.error((err as Error).message);
        //        } else {
        //            console.error("Undefined error in getTransaction()");
        //        }

        //    });

        return tx;
    }

    private removeKeyProperty(objectStore: IDBPObjectStore<unknown, [string], string, "readonly" | "readwrite" | "versionchange">, data: any) {
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
        const outcomes: UpgradeOutcome[] = [];
        if (oldVersion < newVersion) {
            if (dbStore.stores) {
                for (var store of dbStore.stores) {
                    if (!upgradeDB.objectStoreNames.contains(store.name)) {
                        this.addNewStore(upgradeDB, store);
                        const message = `Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
                        outcomes.push({ type: "TableCreated", message });
                        continue;
                    }
                    const table = transaction.objectStore(store.name);
                    for (const indexSpec of store.indexes) {
                        if (table.indexNames.contains(indexSpec.name)) {
                            continue;
                        }
                        table.createIndex(indexSpec.name, indexSpec.keyPath, { unique: indexSpec.unique });
                        const message = `Index ${indexSpec.name} created inside ${store.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
                        outcomes.push({ type: "IndexCreated", message });
                    }
                }
            }
        }
        return outcomes;
    }

    private async verifySchema(upgradeDB: IDBPDatabase, dbStore: IDbStore) {
        const result = {
            success: true,
            message: ""
        }
        if (dbStore.stores) {
            for (var store of dbStore.stores) {
                if (!upgradeDB.objectStoreNames.contains(store.name)) {
                    result.success = false;
                    result.message += `\r\nStore ${store.name} not found in database`;
                }
                const a = await upgradeDB.getAll(store.name);
                const b = await upgradeDB.getAllKeys(store.name);
                console.log(a, b);

            }
        }
        return result;
    }

    private addNewStore(upgradeDB: IDBPDatabase, store: IStoreSchema) {
        let primaryKey = store.primaryKey;

        if (!primaryKey) {
            primaryKey = { name: "id", keyPath: "id", auto: true };
        }

        const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKey.keyPath, autoIncrement: primaryKey.auto, });

        for (var index of store.indexes) {
            newStore.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
    }



    private async notifyRecordDeleted(key: any, storeName: string) {
        const msg = `Deleted record with id ${key} from store ${storeName}`;
        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordDeleted", msg);
        return msg;
    }
}