// node_modules/idb/build/index.js
var instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
var idbProxyableTypes;
var cursorAdvanceMethods;
function getIdbProxyableTypes() {
  return idbProxyableTypes || (idbProxyableTypes = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function getCursorAdvanceMethods() {
  return cursorAdvanceMethods || (cursorAdvanceMethods = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
var transactionDoneMap = /* @__PURE__ */ new WeakMap();
var transformCache = /* @__PURE__ */ new WeakMap();
var reverseTransformCache = /* @__PURE__ */ new WeakMap();
function promisifyRequest(request) {
  const promise = new Promise((resolve, reject) => {
    const unlisten = () => {
      request.removeEventListener("success", success);
      request.removeEventListener("error", error);
    };
    const success = () => {
      resolve(wrap(request.result));
      unlisten();
    };
    const error = () => {
      reject(request.error);
      unlisten();
    };
    request.addEventListener("success", success);
    request.addEventListener("error", error);
  });
  reverseTransformCache.set(promise, request);
  return promise;
}
function cacheDonePromiseForTransaction(tx) {
  if (transactionDoneMap.has(tx))
    return;
  const done = new Promise((resolve, reject) => {
    const unlisten = () => {
      tx.removeEventListener("complete", complete);
      tx.removeEventListener("error", error);
      tx.removeEventListener("abort", error);
    };
    const complete = () => {
      resolve();
      unlisten();
    };
    const error = () => {
      reject(tx.error || new DOMException("AbortError", "AbortError"));
      unlisten();
    };
    tx.addEventListener("complete", complete);
    tx.addEventListener("error", error);
    tx.addEventListener("abort", error);
  });
  transactionDoneMap.set(tx, done);
}
var idbProxyTraps = {
  get(target, prop, receiver) {
    if (target instanceof IDBTransaction) {
      if (prop === "done")
        return transactionDoneMap.get(target);
      if (prop === "store") {
        return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
      }
    }
    return wrap(target[prop]);
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
  has(target, prop) {
    if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
      return true;
    }
    return prop in target;
  }
};
function replaceTraps(callback) {
  idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
  if (getCursorAdvanceMethods().includes(func)) {
    return function(...args) {
      func.apply(unwrap(this), args);
      return wrap(this.request);
    };
  }
  return function(...args) {
    return wrap(func.apply(unwrap(this), args));
  };
}
function transformCachableValue(value) {
  if (typeof value === "function")
    return wrapFunction(value);
  if (value instanceof IDBTransaction)
    cacheDonePromiseForTransaction(value);
  if (instanceOfAny(value, getIdbProxyableTypes()))
    return new Proxy(value, idbProxyTraps);
  return value;
}
function wrap(value) {
  if (value instanceof IDBRequest)
    return promisifyRequest(value);
  if (transformCache.has(value))
    return transformCache.get(value);
  const newValue = transformCachableValue(value);
  if (newValue !== value) {
    transformCache.set(value, newValue);
    reverseTransformCache.set(newValue, value);
  }
  return newValue;
}
var unwrap = (value) => reverseTransformCache.get(value);
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
  const request = indexedDB.open(name, version);
  const openPromise = wrap(request);
  if (upgrade) {
    request.addEventListener("upgradeneeded", (event) => {
      upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
    });
  }
  if (blocked) {
    request.addEventListener("blocked", (event) => blocked(
      // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
      event.oldVersion,
      event.newVersion,
      event
    ));
  }
  openPromise.then((db) => {
    if (terminated)
      db.addEventListener("close", () => terminated());
    if (blocking) {
      db.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
    }
  }).catch(() => {
  });
  return openPromise;
}
function deleteDB(name, { blocked } = {}) {
  const request = indexedDB.deleteDatabase(name);
  if (blocked) {
    request.addEventListener("blocked", (event) => blocked(
      // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
      event.oldVersion,
      event
    ));
  }
  return wrap(request).then(() => void 0);
}
var readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
var writeMethods = ["put", "add", "delete", "clear"];
var cachedMethods = /* @__PURE__ */ new Map();
function getMethod(target, prop) {
  if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
    return;
  }
  if (cachedMethods.get(prop))
    return cachedMethods.get(prop);
  const targetFuncName = prop.replace(/FromIndex$/, "");
  const useIndex = prop !== targetFuncName;
  const isWrite = writeMethods.includes(targetFuncName);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
  ) {
    return;
  }
  const method = async function(storeName, ...args) {
    const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
    let target2 = tx.store;
    if (useIndex)
      target2 = target2.index(args.shift());
    return (await Promise.all([
      target2[targetFuncName](...args),
      isWrite && tx.done
    ]))[0];
  };
  cachedMethods.set(prop, method);
  return method;
}
replaceTraps((oldTraps) => ({
  ...oldTraps,
  get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
  has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
}));
var advanceMethodProps = ["continue", "continuePrimaryKey", "advance"];
var methodMap = {};
var advanceResults = /* @__PURE__ */ new WeakMap();
var ittrProxiedCursorToOriginalProxy = /* @__PURE__ */ new WeakMap();
var cursorIteratorTraps = {
  get(target, prop) {
    if (!advanceMethodProps.includes(prop))
      return target[prop];
    let cachedFunc = methodMap[prop];
    if (!cachedFunc) {
      cachedFunc = methodMap[prop] = function(...args) {
        advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
      };
    }
    return cachedFunc;
  }
};
async function* iterate(...args) {
  let cursor = this;
  if (!(cursor instanceof IDBCursor)) {
    cursor = await cursor.openCursor(...args);
  }
  if (!cursor)
    return;
  cursor = cursor;
  const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
  ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
  reverseTransformCache.set(proxiedCursor, unwrap(cursor));
  while (cursor) {
    yield proxiedCursor;
    cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
    advanceResults.delete(proxiedCursor);
  }
}
function isIteratorProp(target, prop) {
  return prop === Symbol.asyncIterator && instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor]) || prop === "iterate" && instanceOfAny(target, [IDBIndex, IDBObjectStore]);
}
replaceTraps((oldTraps) => ({
  ...oldTraps,
  get(target, prop, receiver) {
    if (isIteratorProp(target, prop))
      return iterate;
    return oldTraps.get(target, prop, receiver);
  },
  has(target, prop) {
    return isIteratorProp(target, prop) || oldTraps.has(target, prop);
  }
}));

// client/indexedDbBlazor.ts
var RAISE_EVENT_METHOD = "RaiseNotificationFromJS";
var IndexedDbManager = class {
  dbInstance;
  _dbManagerRef;
  // private upgradeChannel: BroadcastChannel; 
  constructor(dbManagerRef) {
    this._dbManagerRef = dbManagerRef;
  }
  upgradeChannelMessageHandler = (ev) => {
    console.log("Upgrade message received.");
    if (this.dbInstance) {
      this.dbInstance?.close();
    }
  };
  async openDb(data) {
    const dbStore = data;
    try {
      if (!this.dbInstance || this.dbInstance.version < dbStore.version) {
        if (this.dbInstance) {
          this.dbInstance.close();
        }
        this.dbInstance = await openDB(dbStore.dbName, dbStore.version, {
          upgrade: async (database, oldVersion, newVersion, transaction) => {
            debugger;
            await this.upgradeDatabase(database, dbStore, oldVersion, newVersion, transaction);
          },
          blocked: async (currentVersion, blockedVersion, event) => {
            const msg2 = `Database upgrade blocked. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
            console.warn(msg2, event);
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseUpgradeBlocked", msg2);
          },
          blocking: async (currentVersion, blockedVersion, event) => {
            const msg2 = `Database upgrade blocking. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
            console.warn(msg2, event);
            await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseUpgradeBlocking", msg2);
            this.dbInstance?.close();
          }
        });
      }
    } catch (e) {
      const msg2 = `Could not open db, will try again. ${e}`;
      console.error(msg2);
      this.dbInstance = await openDB(dbStore.dbName);
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseOpenFailure", msg2);
    }
    const result = await this.verifySchema(this.dbInstance, dbStore);
    if (result.success === false) {
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "SchemaVerificationFailure", result.message);
    }
    const msg = `IndexedDB ${data.dbName} opened`;
    await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseOpened", msg);
    return msg;
  }
  getStoreNames(list) {
    const names = [];
    for (const storeName of list) {
      names.push(storeName);
    }
    return names;
  }
  async getDbInfo(dbName) {
    if (!this.dbInstance) {
      this.dbInstance = await openDB(dbName);
    }
    const currentDb = this.dbInstance;
    const dbInfo = {
      name: currentDb.name,
      version: currentDb.version,
      storeNames: this.getStoreNames(currentDb.objectStoreNames)
    };
    return dbInfo;
  }
  async deleteDb(dbName) {
    this.dbInstance?.close();
    await deleteDB(dbName);
    this.dbInstance = void 0;
    const msg = `The database ${dbName} has been deleted.`;
    await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "DatabaseDeleted", msg);
    return msg;
  }
  async addRecord(record) {
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
      const dbResult = await objectStore.get(result);
      await tx.done;
      const msg = `Added new record with id ${result}`;
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordAdded", msg);
      const addResult = {
        storeName: record.storeName,
        key: result,
        data: dbResult
      };
      return addResult;
    } catch (e) {
      const msg = `Error adding record: ${e}`;
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordAddFailure", msg);
      throw msg;
    }
  }
  async updateRecord(record) {
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
      const addResult = {
        storeName: record.storeName,
        key: result,
        data: dbResult
      };
      const msg = `Updated record with id ${result}`;
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordUpdated", msg);
      return addResult;
    } catch (e) {
      const msg = `Error updating record: ${e}`;
      await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordUpdateFailure", msg);
      throw msg;
    }
  }
  async deleteRecord(record) {
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
    } catch (e) {
      await this.notifyDeleteFailure(e);
    }
  }
  async deleteRecordByKey(storename, id) {
    const tx = this.getTransaction(storename, "readwrite");
    const objectStore = tx.objectStore(storename);
    try {
      if (!objectStore.delete) {
        throw new Error("delete method not available on object store");
      }
      await objectStore.delete(id);
      return await this.notifyRecordDeleted(id, storename);
    } catch (e) {
      await this.notifyDeleteFailure(e);
    }
  }
  getRecords = async (storeName) => {
    const tx = this.getTransaction(storeName, "readonly");
    let results = await tx.objectStore(storeName).getAll();
    await tx.done;
    return results;
  };
  clearStore = async (storeName) => {
    const tx = this.getTransaction(storeName, "readwrite");
    await tx.objectStore(storeName).clear?.();
    await tx.done;
    return `Store ${storeName} cleared`;
  };
  getRecordByIndex = async (searchData) => {
    const tx = this.getTransaction(searchData.storeName, "readonly");
    const results = await tx.objectStore(searchData.storeName).index(searchData.indexName).get(searchData.queryValue);
    await tx.done;
    return results;
  };
  getAllRecordsByIndex = async (searchData) => {
    const tx = this.getTransaction(searchData.storeName, "readonly");
    const results = [];
    const recordIterator = tx.objectStore(searchData.storeName).index(searchData.indexName).iterate(searchData.queryValue, "next");
    for await (const cursor of recordIterator) {
      results.push(cursor.value);
    }
    await tx.done;
    console.log(recordIterator);
    return results;
  };
  getRecordById = async (storename, id) => {
    const tx = this.getTransaction(storename, "readonly");
    let result = await tx.objectStore(storename).get(id);
    return result;
  };
  async notifyDeleteFailure(e) {
    const msg = `Error deleting record: ${e}`;
    await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordDeleteFailure", msg);
    throw msg;
  }
  getTransaction(stName, mode) {
    const tx = this.dbInstance.transaction(stName, mode);
    return tx;
  }
  removeKeyProperty(objectStore, data) {
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
  upgradeDatabase(upgradeDB, dbStore, oldVersion, newVersion, transaction) {
    if (oldVersion < newVersion) {
      if (dbStore.stores) {
        for (var store of dbStore.stores) {
          if (!upgradeDB.objectStoreNames.contains(store.name)) {
            this.addNewStore(upgradeDB, store);
            const msg = `Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
            this._dbManagerRef.invokeMethod(RAISE_EVENT_METHOD, "TableCreated", msg);
            continue;
          }
          const table = transaction.objectStore(store.name);
          for (const indexSpec of store.indexes) {
            debugger;
            if (table.indexNames.contains(indexSpec.name)) {
              continue;
            }
            table.createIndex(indexSpec.name, indexSpec.keyPath, { unique: indexSpec.unique });
            const msg = `Index ${indexSpec.name} created inside ${store.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
            this._dbManagerRef.invokeMethod(RAISE_EVENT_METHOD, "IndexCreated", msg);
          }
        }
      }
    }
  }
  async verifySchema(upgradeDB, dbStore) {
    const result = {
      success: true,
      message: ""
    };
    if (dbStore.stores) {
      for (var store of dbStore.stores) {
        if (!upgradeDB.objectStoreNames.contains(store.name)) {
          result.success = false;
          result.message += `\r
Store ${store.name} not found in database`;
        }
        const a = await upgradeDB.getAll(store.name);
        const b = await upgradeDB.getAllKeys(store.name);
        console.log(a, b);
      }
    }
    return result;
  }
  addNewStore(upgradeDB, store) {
    let primaryKey = store.primaryKey;
    if (!primaryKey) {
      primaryKey = { name: "id", keyPath: "id", auto: true };
    }
    const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKey.keyPath, autoIncrement: primaryKey.auto });
    for (var index of store.indexes) {
      newStore.createIndex(index.name, index.keyPath, { unique: index.unique });
    }
  }
  async notifyRecordDeleted(key, storeName) {
    const msg = `Deleted record with id ${key} from store ${storeName}`;
    await this._dbManagerRef.invokeMethodAsync(RAISE_EVENT_METHOD, "RecordDeleted", msg);
    return msg;
  }
};

// client/app.ts
var IDBManager;
var _dbManagerRef;
function initIndexedDbManager(dbManagerRef) {
  if (IDBManager) {
    return;
  }
  IDBManager = new IndexedDbManager(dbManagerRef);
  _dbManagerRef = dbManagerRef;
  console.log("IndexedDbManager initialized");
}
export {
  IDBManager,
  initIndexedDbManager
};
//# sourceMappingURL=client.js.map
