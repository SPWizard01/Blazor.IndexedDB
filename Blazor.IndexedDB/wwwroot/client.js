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
var IndexedDbManager = class {
  instances = [];
  _dbManagerRef;
  // private upgradeChannel: BroadcastChannel; 
  constructor(dbManagerRef) {
    this._dbManagerRef = dbManagerRef;
  }
  async openDb(dbStore) {
    const dbOpenOutcomes = [];
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
            const outcomes = this.upgradeDatabase(database, dbStore, oldVersion, newVersion, transaction);
            await transaction.done;
            dbOpenOutcomes.push(...outcomes);
          },
          blocked: async (currentVersion, blockedVersion, event) => {
            const message = `Database upgrade blocked. Current version: ${currentVersion}, Blocked version: ${blockedVersion}`;
            console.warn(message, event);
            dbOpenOutcomes.push(
              this.getFailureResult(message, "DatabaseUpgradeBlocked")
            );
          },
          blocking: async (currentVersion, blockedVersion, event) => {
            const message = `Database upgrade blocking. Current version: ${currentVersion}, Blocked version: ${blockedVersion}, trying to close db.`;
            console.warn(message, event);
            try {
              let blockingInstance = this.getInstance(dbStore.name);
              ;
              blockingInstance?.instance.close();
              dbOpenOutcomes.push(
                this.getSuccessResult(message, void 0, "DatabaseUpgradeBlocking")
              );
            } catch (e) {
              const message2 = `Could not close db, will try again. ${e}`;
              console.error(message2);
              dbOpenOutcomes.push(
                this.getFailureResult(message2, "DatabaseUpgradeBlocking")
              );
            }
          }
        });
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
    } catch (e) {
      const msg = `Could not verify schema ${e}`;
      dbOpenOutcomes.push(
        this.getFailureResult(msg, "SchemaVerificationError")
      );
    }
    return dbOpenOutcomes;
  }
  getStoreNames(list) {
    const names = [];
    for (const storeName of list) {
      names.push(storeName);
    }
    return names;
  }
  async getDbInfo(dbName) {
    try {
      const instance = this.getInstance(dbName).instance;
      const dbInfo = {
        name: instance.name,
        version: instance.version,
        storeNames: this.getStoreNames(instance.objectStoreNames)
      };
      return this.getSuccessResult("Database information retrieved", dbInfo);
    } catch (e) {
      return this.getFailureResult(`Error getting database information: ${e}`);
    }
  }
  async deleteDb(dbName) {
    try {
      const db = this.getInstance(dbName);
      db?.instance.close();
      await deleteDB(dbName);
      if (db) {
        this.instances.splice(this.instances.indexOf(db), 1);
      }
      const msg = `The database ${dbName} has been deleted.`;
      return this.getSuccessResult(msg, void 0);
    } catch (e) {
      return this.getFailureResult(`Error deleting database: ${e}`);
    }
  }
  //#region CRUD
  async addRecord(dbName, record) {
    const stName = record.storeName;
    let itemToSave = record.data;
    try {
      const tx = this.getTransaction(dbName, stName, "readwrite");
      const objectStore = tx.objectStore(stName);
      itemToSave = this.removePrimaryKeyPropertyIfAutoIncrement(objectStore, itemToSave);
      if (!objectStore.add) {
        return this.getFailureResult("Add method not available on object store");
      }
      console.log(itemToSave);
      const result = await objectStore.add(itemToSave);
      const dbResult = await objectStore.get(result);
      await tx.done;
      const msg = `Added new record with id ${result}`;
      return this.getSuccessResult(msg, dbResult);
    } catch (e) {
      return this.getFailureResult(`Error adding record: ${e}`);
    }
  }
  async updateRecord(dbName, record) {
    const stName = record.storeName;
    try {
      const tx = this.getTransaction(dbName, stName, "readwrite");
      const objectStore = tx.objectStore(stName);
      if (!objectStore.put) {
        return this.getFailureResult("Put method not available on object store");
      }
      const result = await objectStore.put(record.data, record.key);
      const dbResult = await objectStore.get(result);
      await tx.done;
      const msg = `Updated record with id ${result}`;
      return this.getSuccessResult(msg, dbResult);
    } catch (e) {
      return this.getFailureResult(`Error updating record: ${e}`);
    }
  }
  async deleteRecordByQuery(dbName, query) {
    try {
      const { tx, objectStore, idbKeyResult } = this.getStoreQuery(dbName, query, "readwrite");
      if (!objectStore.delete) {
        return this.getFailureResult("delete method not available on object store");
      }
      if (!idbKeyResult.success) {
        return this.getFailureResult(`Error deleting record: ${idbKeyResult.message}`);
      }
      await objectStore.delete(idbKeyResult.data.value);
      await tx.done;
      return this.getSuccessResult(`Deleted records from store ${query.storeName}`, void 0);
    } catch (e) {
      return this.getFailureResult(`Error deleting record: ${e}`);
    }
  }
  async deleteRecordByKey(dbName, storename, id) {
    try {
      const tx = this.getTransaction(dbName, storename, "readwrite");
      const objectStore = tx.objectStore(storename);
      if (!objectStore.delete) {
        return this.getFailureResult("delete method not available on object store");
      }
      await objectStore.delete(id);
      return this.getSuccessResult(`Deleted record with key ${id} from store ${storename}`, void 0);
    } catch (e) {
      return this.getFailureResult(`Error deleting record: ${e}`);
    }
  }
  async clearStore(dbName, storeName) {
    try {
      const tx = this.getTransaction(dbName, storeName, "readwrite");
      await tx.objectStore(storeName).clear?.();
      await tx.done;
      return this.getSuccessResult(`Store ${storeName} cleared`, void 0);
    } catch (e) {
      return this.getFailureResult(`Error clearing store ${storeName}: ${e}`);
    }
  }
  //#endregion
  //#region IndexQueries
  async iterateRecordsByIndex(dbName, searchData, direction) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = [];
      const recordIterator = index.iterate(idbKeyResult.data.value, direction);
      for await (const cursor of recordIterator) {
        results.push(cursor.value);
      }
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  async getRecordByIndex(dbName, searchData) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await index.get(idbKeyResult.data.value);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  async getAllRecordsByIndexQuery(dbName, searchData, count) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await index.getAll(idbKeyResult.data.value, count);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  async getAllRecordsByIndex(dbName, searchData) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await index.getAll();
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  async getAllKeysByIndex(dbName, searchData, count) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await index.getAllKeys(idbKeyResult.data.value, count);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  async getKeyByIndex(dbName, searchData) {
    try {
      const { index, tx, idbKeyResult } = this.getIndexQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await index.getKey(idbKeyResult.data.value);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.indexName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName} index ${searchData.indexName}: ${e}`);
    }
  }
  //#endregion
  //#region StoreRecordQueries
  async iterateRecords(dbName, searchData, direction) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = [];
      const recordIterator = objectStore.iterate(idbKeyResult.data.value, direction);
      for await (const cursor of recordIterator) {
        results.push(cursor.value);
      }
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  async *iterateAsyncRecords(dbName, searchData, direction) {
    console.log("Iterating async records");
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = [];
      const recordIterator = objectStore.iterate(idbKeyResult.data.value, direction);
      for await (const cursor of recordIterator) {
        yield this.getSuccessResult(`Record retrieved from index ${searchData.storeName}`, results);
      }
      await tx.done;
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  async getRecord(dbName, searchData) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await objectStore.get(idbKeyResult.data.value);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from table ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records table ${searchData.storeName}: ${e}`);
    }
  }
  async getAllRecords(dbName, searchData) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await objectStore.getAll();
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  async getAllRecordsByQuery(dbName, searchData, count) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await objectStore.getAll(idbKeyResult.data.value, count);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  async getAllKeys(dbName, searchData, count) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await objectStore.getAllKeys(idbKeyResult.data.value, count);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  async getKey(dbName, searchData) {
    try {
      const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = await objectStore.getKey(idbKeyResult.data.value);
      await tx.done;
      return this.getSuccessResult(`Records retrieved from index ${searchData.storeName}`, results);
    } catch (e) {
      return this.getFailureResult(`Error getting records from ${searchData.storeName}: ${e}`);
    }
  }
  //#endregion
  getIDBKey(query) {
    let result;
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
        return this.getFailureResult(`Invalid query type ${query.queryType}`);
    }
    return this.getSuccessResult("IDBKey created", result);
  }
  getIndexQuery(dbName, searchData, transactionMode) {
    const { objectStore, tx, idbKeyResult } = this.getStoreQuery(dbName, searchData, transactionMode);
    const index = objectStore.index(searchData.indexName);
    return { index, tx, idbKeyResult };
  }
  getStoreQuery(dbName, searchData, transactionMode) {
    const tx = this.getTransaction(dbName, searchData.storeName, transactionMode);
    const objectStore = tx.objectStore(searchData.storeName);
    const idbKeyResult = this.getIDBKey(searchData.queryValue);
    return { objectStore, tx, idbKeyResult };
  }
  getTransaction(dbName, stName, mode) {
    const db = this.getInstance(dbName);
    const tx = db.instance.transaction(stName, mode);
    return tx;
  }
  removePrimaryKeyPropertyIfAutoIncrement(objectStore, data) {
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
  upgradeDatabase(upgradeDB, dbStore, oldVersion, newVersion, transaction) {
    const outcomes = [];
    if (oldVersion < newVersion) {
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
      }
    }
    return outcomes;
  }
  async verifySchema(upgradeDB, dbStore) {
    const result = [];
    if (dbStore.stores) {
      for (var store of dbStore.stores) {
        if (!upgradeDB.objectStoreNames.contains(store.name)) {
          result.push(
            this.getFailureResult(`Store ${store.name} not found in database`, "StoreNotFound")
          );
          continue;
        }
        const tx = upgradeDB.transaction(store.name, "readonly");
        const table = tx.objectStore(store.name);
        for (const appIndex of store.indexes) {
          if (!table.indexNames.contains(appIndex.name)) {
            result.push(
              this.getFailureResult(`Index ${appIndex.name} not found in store ${store.name}`, "IndexNotFound")
            );
            continue;
          }
          const idx = table.index(appIndex.name);
          if (Array.isArray(idx.keyPath)) {
            for (const idxKey of idx.keyPath) {
              if (!appIndex.keyPath.includes(idxKey)) {
                result.push(
                  this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, "IndexKeyPathMismatch")
                );
              }
            }
          } else {
            if (!appIndex.keyPath.includes(idx.keyPath)) {
              result.push(
                this.getFailureResult(`Index ${appIndex.name} keyPath does not match. Expected: ${appIndex.keyPath}, Actual: ${idx.keyPath}`, "IndexKeyPathMismatch")
              );
            }
          }
        }
      }
    }
    return result;
  }
  addNewStore(upgradeDB, store, oldVersion, newVersion) {
    const storeOutcomes = [];
    let primaryKey = store.primaryKey;
    if (!primaryKey) {
      primaryKey = { name: "id", keyPath: ["id"], auto: true, multiEntry: false, unique: true, keepAsArrayOnSingleValue: false };
    }
    const primaryKeyPath = primaryKey.keyPath.length == 1 ? primaryKey.keyPath[0] : primaryKey.keyPath;
    try {
      const newStore = upgradeDB.createObjectStore(store.name, { keyPath: primaryKeyPath, autoIncrement: primaryKey.auto });
      storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, void 0, "TableCreated"));
      for (var index of store.indexes) {
        storeOutcomes.push(this.createIndexForStore(index, newStore, oldVersion, newVersion));
      }
    } catch (e) {
      storeOutcomes.push(this.getFailureResult(`Error creating store ${store.name}: ${e}`, "StoreCreationError"));
    }
    return storeOutcomes;
  }
  createIndexForStore(index, newStore, oldVersion, newVersion) {
    let keyPath = index.keyPath;
    if (index.keyPath.length === 1 && !index.keepAsArrayOnSingleValue) {
      keyPath = index.keyPath[0];
    }
    if (index.multiEntry && index.keyPath.length > 1) {
      return this.getFailureResult(`Index ${index.name} has multiEntry set to true but has multiple keyPaths. This is not supported.`, "MultiEntryIndexWithMultipleKeyPaths");
    }
    if (index.multiEntry && index.keyPath.length === 1) {
      keyPath = index.keyPath[0];
    }
    try {
      newStore.createIndex(index.name, keyPath, { unique: index.unique, multiEntry: index.multiEntry });
    } catch (e) {
      return this.getFailureResult(`Error creating index ${index.name} for store ${newStore.name}: ${e}`, "IndexCreationError");
    }
    const message = `Index ${index.name} created inside ${newStore.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`;
    return this.getSuccessResult(message, void 0, "IndexCreated");
  }
  getSuccessResult(successMessage, data, type) {
    const result = {
      success: true,
      data,
      message: successMessage,
      type
    };
    console.log(result);
    return result;
  }
  getFailureResult(errorMessage, type) {
    const result = {
      success: false,
      data: void 0,
      message: errorMessage,
      type
    };
    console.log(result);
    return result;
  }
  getInstance(dbName) {
    return this.instances.find((i) => i.name.toLowerCase() === dbName.toLowerCase());
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
};

// client/app.ts
var IDBManager;
var _dbManagerRef;
function initIndexedDbManager(dbManagerRef) {
  if (IDBManager) {
    return;
  }
  IDBManager = new IndexedDbManager(dbManagerRef);
  window.dbManager = IDBManager;
  _dbManagerRef = dbManagerRef;
  console.log("IndexedDbManager initialized");
}
export {
  IDBManager,
  initIndexedDbManager
};
//# sourceMappingURL=client.js.map
