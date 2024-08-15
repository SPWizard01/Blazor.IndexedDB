import { IDBPObjectStore, IDBPDatabase, openDB, deleteDB, TypedDOMStringList, StoreNames } from "idb";
import { IDbStore, IIndexSearch, IStoreRecord, IStoreSchema, DBInformation } from "./InteropInterfaces";
import { DotNet } from "@microsoft/dotnet-js-interop";
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
                    upgrade: async (database, oldVersion, newVersion) => {
                        await this.upgradeDatabase(database, dbStore, oldVersion, newVersion!);
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

    public async getDbInfo(dbName: string) {
        if (!this.dbInstance) {
            this.dbInstance = await openDB(dbName);
        }

        const currentDb = <IDBPDatabase>this.dbInstance;

        const getStoreNames = (list: TypedDOMStringList<StoreNames<any>>) => {
            const names: string[] = [];
            for (const storeName of list) {
                names.push(storeName);
            }
            return names;
        }
        const dbInfo: DBInformation = {
            name: currentDb.name,
            version: currentDb.version,
            storeNames: getStoreNames(currentDb.objectStoreNames)
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

        itemToSave = this.checkForKeyPath(objectStore, itemToSave);

        const result = await objectStore.add?.(itemToSave, record.key);
        await tx.done;
        return `Added new record with id ${result}`;
    }

    public updateRecord = async (record: IStoreRecord): Promise<string> => {
        const stName = record.storeName;
        const tx = this.getTransaction(stName, "readwrite");

        const result = await tx.objectStore(stName).put?.(record.data, record.key);

        return `updated record with id ${result}`;
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

    public deleteRecord = async (storename: string, id: any): Promise<string> => {
        const tx = this.getTransaction(storename, "readwrite");
        await tx.objectStore(storename).delete?.(id);

        return `Record with id: ${id} deleted`;
    }

    private getTransaction(stName: string, mode?: IDBTransactionMode) {
        const tx = this.dbInstance!.transaction(stName, mode);
        tx.done.catch(
            err => {
                if (err) {
                    console.error((err as Error).message);
                } else {
                    console.error("Undefined error in getTransaction()");
                }

            });

        return tx;
    }

    // Currently don"t support aggregate keys
    private checkForKeyPath(objectStore: IDBPObjectStore<unknown, [string], string, "readonly" | "readwrite" | "versionchange">, data: any) {
        if (!objectStore.autoIncrement || !objectStore.keyPath) {
            return data;
        }

        if (typeof objectStore.keyPath !== "string") {
            return data;
        }

        const keyPath = objectStore.keyPath as string;

        if (!data[keyPath]) {
            delete data[keyPath];
        }
        return data;
    }

    private async upgradeDatabase(upgradeDB: IDBPDatabase, dbStore: IDbStore, oldVersion: number, newVersion: number) {
        if (oldVersion < newVersion) {
            if (dbStore.stores) {
                for (var store of dbStore.stores) {
                    if (!upgradeDB.objectStoreNames.contains(store.name)) {
                        this.addNewStore(upgradeDB, store);
                        const msg = `Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
                        await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "TableCreated", msg)
                    }
                }
            }
        }
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

        const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKey.keyPath, autoIncrement: primaryKey.auto });

        for (var index of store.indexes) {
            newStore.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
    }
}