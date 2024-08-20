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
              const baseInfo = { databaseName: dbStore.name, storeName: "" };
              dbOpenOutcomes.push(
                this.getSuccessResult(message, void 0, baseInfo, "DatabaseUpgradeBlocking")
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
        dbInstance = { name: dbStore.name, instance, executingCursors: [] };
        this.instances.push(dbInstance);
      }
    } catch (e) {
      dbOpenOutcomes.push(
        this.getFailureResult(`Could not open db ${e}`, "DatabaseOpenError")
      );
      return dbOpenOutcomes;
    }
    try {
      const result = await this.verifySchema(dbInstance.instance, dbStore);
      dbOpenOutcomes.push(...result);
    } catch (e) {
      dbOpenOutcomes.push(
        this.getFailureResult(`Could not verify schema ${e}`, "SchemaVerificationError")
      );
    }
    return dbOpenOutcomes;
  }
  async deleteDb(databaseName) {
    try {
      const db = this.getInstance(databaseName);
      db?.instance.close();
      await deleteDB(databaseName);
      if (db) {
        this.instances.splice(this.instances.indexOf(db), 1);
      }
      const msg = `The database ${databaseName} has been deleted.`;
      return this.getSuccessResult(msg, void 0, { databaseName, storeName: "" }, "DatabaseDeleted");
    } catch (e) {
      return this.getFailureResult(`Error deleting database: ${e}`, "DatabaseDeleteError");
    }
  }
  async getDatabaseInfo(dbName) {
    try {
      const instance = this.getInstance(dbName).instance;
      const dbInfo = {
        name: instance.name,
        version: instance.version,
        storeNames: this.getStoreNames(instance.objectStoreNames)
      };
      return this.getSuccessResult("Database information retrieved", dbInfo, { databaseName: instance.name, storeName: "" }, "DatabaseInfo");
    } catch (e) {
      return this.getFailureResult(`Error getting database information: ${e}`, "DatabaseInfoError");
    }
  }
  //#region CRUD
  async addRecord(record) {
    let itemToSave = record.data;
    try {
      const { tx, objectStore, idbKeyResult } = this.getStoreQuery(record, "readwrite");
      itemToSave = this.removePrimaryKeyPropertyIfAutoIncrement(objectStore, itemToSave);
      if (!objectStore.add) {
        return this.getFailureResult("Add method not available on object store", "RecordQueryError");
      }
      let key = void 0;
      if (!idbKeyResult.success && record.useKey) {
        return this.getFailureResult("Unable to update record, key not valid", "RecordQueryError");
      }
      if (idbKeyResult.success && record.useKey) {
        key = idbKeyResult.result.data.value;
      }
      const result = await objectStore.add(itemToSave, key);
      const dbResult = await objectStore.get(result);
      await tx.done;
      const msg = `Added new record with id ${result}`;
      return this.getSuccessResult(msg, dbResult, record, "Record");
    } catch (e) {
      return this.getFailureResult(`Error adding record: ${e}`, "RecordQueryError");
    }
  }
  async updateRecord(record) {
    try {
      const { tx, idbKeyResult, objectStore } = this.getStoreQuery(record, "readwrite");
      if (!objectStore.put) {
        return this.getFailureResult("Put method not available on object store", "RecordQueryError");
      }
      let key = void 0;
      if (!idbKeyResult.success && record.useKey) {
        return this.getFailureResult("Unable to update record, key not valid", "RecordQueryError");
      }
      if (idbKeyResult.success && record.useKey) {
        key = idbKeyResult.result.data.value;
      }
      const result = await objectStore.put(record.data, key);
      const dbResult = await objectStore.get(result);
      await tx.done;
      const msg = `Updated record with id ${result}`;
      return this.getSuccessResult(msg, dbResult, record, "Record");
    } catch (e) {
      return this.getFailureResult(`Error updating record: ${e}`, "RecordQueryError");
    }
  }
  async deleteRecord(query) {
    try {
      const { tx, objectStore, idbKeyResult } = this.getStoreQuery(query, "readwrite");
      if (!objectStore.delete) {
        return this.getFailureResult("delete method not available on object store", "RecordQueryError");
      }
      if (!idbKeyResult.success) {
        return this.getFailureResult(`Error deleting record: ${idbKeyResult.message}`, "RecordQueryError");
      }
      if (idbKeyResult.result.data.type === "NoQuery") {
        return this.getFailureResult(`Error deleting record: NoQuery is not a valid query`, "RecordQueryError");
      }
      await objectStore.delete(idbKeyResult.result.data.value);
      await tx.done;
      return this.getSuccessResult(`Deleted records from store ${query.storeName}`, void 0, query, "RecordDeleted");
    } catch (e) {
      return this.getFailureResult(`Error deleting record: ${e}`, "RecordQueryError");
    }
  }
  async clearStore(record) {
    try {
      const { tx, objectStore } = this.getTransaction(record, "readwrite");
      if (!objectStore.clear) {
        return this.getFailureResult("Clear method not available on object store", "StoreQueryError");
      }
      await objectStore.clear();
      await tx.done;
      return this.getSuccessResult(`Store ${record.storeName} cleared`, void 0, record, "StoreCleared");
    } catch (e) {
      return this.getFailureResult(`Error clearing store ${record.storeName}: ${e}`, "StoreQueryError");
    }
  }
  //#endregion
  //#region StoreRecordQueries
  async openCursor(searchData, direction) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const instance = this.getInstance(searchData.databaseName);
      const executingCursor = this.getInstanceExecutingCursor(instance, searchData);
      if (executingCursor) {
        return this.getFailureResult(`Another cursor is already open`, "CursorFailure");
      }
      const query = idbKeyResult.result.data.value;
      const queryObject = index ?? objectStore;
      const rs = await queryObject.openCursor(query, direction);
      await tx.done;
      if (rs?.value) {
        instance.executingCursors.push({ initialQuery: searchData, cursorPosition: 1, direction });
        return this.getSuccessResult(`Cursor result ${queryPath}`, rs.value, searchData, "CursorRecord");
      }
      return this.getSuccessResult(`Cursor result ${queryPath}`, void 0, searchData, "CursorNoMoreRecords");
    } catch (e) {
      return this.getFailureResult(`Error getting records ${e}`, "CursorFailure");
    }
  }
  async advanceCursor(searchData) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const instance = this.getInstance(searchData.databaseName);
      const executingCursor = this.getInstanceExecutingCursor(instance, searchData);
      if (executingCursor) {
        const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(executingCursor.initialQuery, "readonly");
        if (!idbKeyResult.success) {
          return idbKeyResult;
        }
        const query = idbKeyResult.result.data.value;
        const queryObject = index ?? objectStore;
        const rs = await queryObject.openCursor(query, executingCursor.direction);
        const next = await rs?.advance(executingCursor.cursorPosition);
        await tx.done;
        if (!next || !next.value) {
          instance.executingCursors.splice(instance.executingCursors.indexOf(executingCursor), 1);
          return this.getSuccessResult(`No more records ${queryPath}`, void 0, searchData, "CursorNoMoreRecords");
        }
        executingCursor.cursorPosition += 1;
        return this.getSuccessResult(`Cursor record ${queryPath}`, next.value, searchData, "CursorRecord");
      }
      return this.getSuccessResult(`No cursor is open ${queryPath}`, void 0, searchData, "CursorNotOpen");
    } catch (e) {
      return this.getFailureResult(`Error getting records ${e}`, "CursorFailure");
    }
  }
  async closeCursor(searchData) {
    try {
      const instance = this.getInstance(searchData.databaseName);
      const executingCursor = this.getInstanceExecutingCursor(instance, searchData);
      if (!executingCursor) {
        return this.getSuccessResult(`No cursor is open`, void 0, searchData, "CursorNotOpen");
      }
      instance.executingCursors.splice(instance.executingCursors.indexOf(executingCursor), 1);
      return this.getSuccessResult(``, void 0, searchData, "CursorNoMoreRecords");
    } catch (e) {
      return this.getFailureResult(`Error closing cursor: ${e}`, "CursorFailure");
    }
  }
  async closeAllStoreCursors(searchData) {
    try {
      const instance = this.getInstance(searchData.databaseName);
      instance.executingCursors = instance.executingCursors.filter(
        (c) => c.initialQuery.databaseName !== searchData.databaseName && c.initialQuery.storeName !== searchData.storeName
      );
      return this.getSuccessResult(``, void 0, searchData, "CursorNoMoreRecords");
    } catch (e) {
      return this.getFailureResult(`Error closing cursor: ${e}`, "CursorFailure");
    }
  }
  async closeAllCursors(databaseName) {
    try {
      const instance = this.getInstance(databaseName);
      instance.executingCursors = [];
      return this.getSuccessResult(``, void 0, { databaseName, storeName: "" }, "CursorNoMoreRecords");
    } catch (e) {
      return this.getFailureResult(`Error closing cursor: ${e}`, "CursorFailure");
    }
  }
  async iterateRecords(searchData, direction) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const results = [];
      const queryObject = index ?? objectStore;
      const recordIterator = queryObject.iterate(idbKeyResult.result.data.value, direction);
      for await (const cursor of recordIterator) {
        results.push(cursor.value);
      }
      await tx.done;
      return this.getSuccessResult(`${results.length} records retrieved ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
    } catch (e) {
      return this.getFailureResult(`Error getting records ${e}`, "StoreQueryError");
    }
  }
  async getRecord(searchData) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      if (idbKeyResult.result.data.type === "NoQuery") {
        return this.getFailureResult(`NoQuery is not a valid query`, "RecordQueryError");
      }
      const queryObject = index ?? objectStore;
      const results = await queryObject.get(idbKeyResult.result.data.value);
      await tx.done;
      return this.getSuccessResult(`${results ? "1" : "0"} record retrieved ${queryPath}`, results, searchData, results ? "Record" : "RecordNotFound");
    } catch (e) {
      return this.getFailureResult(`Error getting record: ${e}`, "StoreQueryError");
    }
  }
  async getAllRecords(searchData, count) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const queryObject = index ?? objectStore;
      const results = await queryObject.getAll(idbKeyResult.result.data.value, count > 0 ? count : void 0);
      await tx.done;
      return this.getSuccessResult(`${results.length} records retrieved from ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
    } catch (e) {
      return this.getFailureResult(`Error getting records: ${e}`, "StoreQueryError");
    }
  }
  async getAllKeys(searchData, count) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      const queryObject = index ?? objectStore;
      const results = await queryObject.getAllKeys(idbKeyResult.result.data.value, count > 0 ? count : void 0);
      await tx.done;
      return this.getSuccessResult(`${results.length} keys retrieved from ${queryPath}`, results, searchData, results.length > 0 ? "Record" : "RecordNotFound");
    } catch (e) {
      return this.getFailureResult(`Error getting keys: ${e}`, "StoreQueryError");
    }
  }
  async getKey(searchData) {
    try {
      const queryPath = this.getQueryPath(searchData);
      const { objectStore, tx, idbKeyResult, index } = this.getStoreQuery(searchData, "readonly");
      if (!idbKeyResult.success) {
        return idbKeyResult;
      }
      if (idbKeyResult.result.data.type === "NoQuery") {
        return this.getFailureResult(`NoQuery is not a valid query`, "RecordQueryError");
      }
      const queryObject = index ?? objectStore;
      const results = await queryObject.getKey(idbKeyResult.result.data.value);
      await tx.done;
      return this.getSuccessResult(`${results ? "1" : "0"} keys retrieved from ${queryPath}`, results, searchData, results ? "Record" : "RecordNotFound");
    } catch (e) {
      return this.getFailureResult(`Error getting keys: ${e}`, "StoreQueryError");
    }
  }
  //#endregion
  getIDBKey(incommingQuery) {
    let result;
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
          result = { type: "NoQuery", value: void 0 };
          break;
        default:
          return this.getFailureResult(`Invalid query type ${query.queryType}`, "IDBKeyFailure");
      }
    } catch (e) {
      return this.getFailureResult(`Failed to create key ${e}`, "IDBKeyFailure");
    }
    return this.getSuccessResult("", result, incommingQuery, "IDBKeyCreated");
  }
  getStoreQuery(searchData, transactionMode) {
    const { tx, objectStore } = this.getTransaction(searchData, transactionMode);
    const idbKeyResult = this.getIDBKey(searchData);
    const index = searchData.indexName ? objectStore.index(searchData.indexName) : void 0;
    return { objectStore, tx, idbKeyResult, index };
  }
  getTransaction(searchData, mode) {
    const db = this.getInstance(searchData.databaseName);
    const tx = db.instance.transaction(searchData.storeName, mode);
    const objectStore = tx.objectStore(searchData.storeName);
    return { tx, objectStore };
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
      const baseInfo = { databaseName: upgradeDB.name, storeName: store.name };
      storeOutcomes.push(this.getSuccessResult(`Store ${store.name} created inside ${upgradeDB.name} as it was missing when upgrading from v${oldVersion} to v${newVersion}`, void 0, baseInfo, "StoreCreated"));
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
    return this.getSuccessResult(message, void 0, { databaseName: "", storeName: newStore.name }, "IndexCreated");
  }
  getSuccessResult(successMessage, data, requestBase, type) {
    const result = {
      success: true,
      result: {
        data,
        databaseName: requestBase.databaseName,
        storeName: requestBase.storeName
      },
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
  getInstanceExecutingCursor(instance, searchData) {
    return instance.executingCursors.find(
      (c) => c.initialQuery.databaseName === searchData.databaseName && c.initialQuery.storeName === searchData.storeName && c.initialQuery.indexName === searchData.indexName && //Might not be the best idea or needed at all
      JSON.stringify(c.initialQuery.queryValue) === JSON.stringify(searchData.queryValue)
    );
  }
  getQueryPath(searchData) {
    return `${searchData.databaseName}->${searchData.storeName}${searchData.indexName ? `->${searchData.indexName}` : ``}`;
  }
  getStoreNames(list) {
    const names = [];
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
