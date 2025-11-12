using Blazor.IndexedDB.ESM.Models;
using Blazor.IndexedDB.ESM.Models.JS;
using Blazor.IndexedDB.ESM.Models.Query;
using Blazor.IndexedDB.ESM.Models.Record;
using Microsoft.Extensions.Logging;
using Microsoft.JSInterop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Blazor.IndexedDB.ESM
{
    /// <summary>
    /// Provides functionality for accessing IndexedDB from Blazor application
    /// </summary>
    public class IndexedDBManager
    {

        private readonly string _assemblyName;
        private readonly IJSRuntime _jsRuntime;
        private readonly DotNetObjectReference<IndexedDBManager> _dbManagerRef;
        private IJSObjectReference? _jsModule;
        private IJSInProcessObjectReference? _jsInProcessModule; // in-process (WebAssembly) module reference
        private readonly bool _isInProcessRuntime; // flag for WebAssembly runtime
        private readonly IndexedDBJSConfig _jsConfig;
        private readonly SemaphoreSlim _initLock = new(1, 1);
        private readonly ILogger _logger;

        /// <summary>
        /// A notification event that is raised when an action is completed
        /// </summary>
        public event EventHandler<IndexedDBActionResult<object>>? ActionCompleted;

        /// <summary>
        /// A collection of IndexedDB databases that are defined in the application
        /// </summary>
        public IndexedDBManagerConfig ManagerConfig { get; }

        public IndexedDBManager(IndexedDBManagerConfig managerConfig, IJSRuntime jsRuntime, ILogger<IndexedDBManager> logger)
        {
            _jsRuntime = jsRuntime;
            _isInProcessRuntime = jsRuntime is IJSInProcessRuntime; // detect WebAssembly runtime
            _assemblyName = GetType().Assembly.GetName().Name ?? "UnknownAssemblyName";
            _dbManagerRef = DotNetObjectReference.Create(this);
            _jsConfig = new IndexedDBJSConfig
            {
                DotNetReference = _dbManagerRef,
                SendNotifications = managerConfig.Config.SendNotifications,
                SendNotificationsFromJS = managerConfig.Config.SendNotificationsFromJS
            };
            ManagerConfig = managerConfig;
            _logger = logger;
        }
        /// <summary>
        /// Opens the IndexedDB defined in the DbStore. Under the covers will create the database if it does not exist
        /// and create the stores defined in DbStore.
        /// </summary>
        /// <returns></returns>
        public Task<List<IndexedDBActionResult<string?>>> OpenDb(string dbName) => OpenDb(ManagerConfig.Databases.First(s => s.Name == dbName));
        public async Task<List<IndexedDBActionResult<string?>>> OpenDb(IndexedDBDatabase db) => await CallJavaScriptReturnMany<string?>(IndexedDBJSModuleMethods.OpenDb, db);

        /// <summary>
        /// Deletes the database corresponding to the dbName passed in
        /// </summary>
        /// <param name="dbName">The name of database to delete</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> DeleteDb(IndexedDBDatabase db)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.DeleteDb, db.Name);
        }

        //TODO: Refactor
        public async Task GetDatabaseInfo(IndexedDBDatabase db)
        {
            var result = await CallJavaScript<DBInformation>(IndexedDBJSModuleMethods.GetDatabaseInfo, db.Name);

            if (result.Result?.Data?.Version > db.Version)
            {
                db.Version = result.Result.Data.Version;

                var currentStores = db.Stores.Select(s => s.Name);

                foreach (var storeName in result.Result.Data.StoreNames)
                {
                    if (!currentStores.Contains(storeName))
                    {
                        db.Stores.Add(new IndexedDBStoreSchema { Name = storeName });

                    }
                }
            }
        }

        //TODO: Refactor
        public async Task AddNewStore(IndexedDBDatabase db, IndexedDBStoreSchema storeSchema)
        {
            if (storeSchema == null)
            {
                return;
            }
            if (db.Stores.Any(s => s.Name == storeSchema.Name))
            {
                return;
            }

            db.Stores.Add(storeSchema);
            db.Version += 1;

            var result = await CallJavaScript<string>(IndexedDBJSModuleMethods.OpenDb, db.Name);

            //RaiseNotification(IndexDBActionOutcome.TableCreated, $"new store {storeSchema.Name} added");
        }

        /// <summary>
        /// Adds a new record/object to the specified store
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToAdd">An instance of StoreRecord that provides the store name and the data to add</param>
        /// <returns></returns>

        public async Task<IndexedDBActionResult<T>> AddRecord<T>(IndexedDBRecordAction<T> recordToAdd)
        {
            return await CallJavaScript<T>(IndexedDBJSModuleMethods.AddRecord, recordToAdd);
        }

        /// <summary>
        /// Updates and existing record
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToUpdate">An instance of StoreRecord with the store name and the record to update</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<T>> UpdateRecord<T>(IndexedDBRecordAction<T> recordToUpdate)
        {
            return await CallJavaScript<T>(IndexedDBJSModuleMethods.UpdateRecord, recordToUpdate);

        }

        /// <summary>
        /// Deletes all records from the store that match the query
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <param name="storeName"></param>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> DeleteRecord(IndexedDBQuery query)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.DeleteRecord, query);
        }



        /// <summary>
        /// Clears all of the records from a given store.
        /// </summary>
        /// <param name="storeName">The name of the store to clear the records from</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> ClearStore(IndexedDBObjectBase target)
        {

            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.ClearStore, target);

        }

        #region ObjectStoreQueryMethods

        /// <summary>
        /// Opens a cursor that returns first matching query record. Later on you can call AdvanceCursor to get the next record
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <param name="direction"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> OpenCursor<TResult>(IndexedDBQuery searchQuery, IndexedDBDirection? direction = null)
        {
            return direction == null ?
                await CallJavaScript<TResult>(IndexedDBJSModuleMethods.OpenCursor, searchQuery) :
                await CallJavaScript<TResult>(IndexedDBJSModuleMethods.OpenCursor, searchQuery, direction);
        }

        /// <summary>
        /// Advances the cursor to the next record that matches the query, the query should be the same as the one used in OpenCursor
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> AdvanceCursor<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethods.AdvanceCursor, searchQuery);
        }

        /// <summary>
        /// Closes the cursor opened by <see cref="OpenCursor"/>
        /// <para>
        /// Parameter <paramref name="searchQuery"/> should be the same as the one used in OpenCursor
        /// </para>
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> CloseCursor(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.CloseCursor, searchQuery);
        }

        /// <summary>
        /// Closes all cursors opened by <see cref="OpenCursor"/> for a given store
        /// <para>
        /// Parameter <paramref name="searchQuery"/> should be the same as the one used in OpenCursor
        /// </para>
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> CloseAllStoreCursors(IndexedDBObjectBase searchQuery)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.CloseAllStoreCursors, searchQuery);
        }

        /// <summary>
        /// Closes all cursors opened by <see cref="OpenCursor"/> for a given database
        /// <para>
        /// Parameter <paramref name="searchQuery"/> should be the same as the one used in OpenCursor
        /// </para>
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> CloseAllCursors(IndexedDBObjectBase searchQuery)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.CloseAllCursors, searchQuery);
        }
        /// <summary>
        /// Closes all cursors opened by <see cref="OpenCursor"/> for a given database
        /// <para>
        /// Parameter <paramref name="databaseName"/> should be the same as the one used in OpenCursor
        /// </para>
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="databaseName"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> CloseAllCursors(string databaseName)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethods.CloseAllCursors, new IndexedDBObjectBase() { DatabaseName = databaseName, StoreName = "" });
        }


        /// <summary>
        /// Iterates over all of the records in a given store (and index if supplied) that match a query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> IterateRecords<TResult>(IndexedDBQuery searchQuery, IndexedDBDirection? direction = null)
        {
            return direction == null ?
                await CallJavaScript<TResult>(IndexedDBJSModuleMethods.IterateRecords, searchQuery) :
                await CallJavaScript<TResult>(IndexedDBJSModuleMethods.IterateRecords, searchQuery, direction);
        }


        /// <summary>
        /// Returns the first record that matches a query
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBQuery">an instance of IndexedDBQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecord<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethods.GetRecord, searchQuery);
        }

        /// <summary>
        /// Gets all of the records that match a given query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <param name="count">-1 returns all records, anything greater than 0 will return limited amount of data</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllRecords<TResult>(IndexedDBQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethods.GetAllRecords, searchQuery, count);
        }

        /// <summary>
        /// Gets all of the primary keys that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <param name="count">-1 returns all records, anything greater than 0 will return limited amount of data</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllKeys<TResult>(IndexedDBQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethods.GetAllKeys, searchQuery, count);
        }

        /// <summary>
        /// Gets first primary key that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetKey<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethods.GetKey, searchQuery);
        }
        #endregion


        #region JSInterop
        private async Task EnsureModule()
        {
            if (_jsModule != null) return;
            await _initLock.WaitAsync();
            try
            {
                if (_jsModule != null) return; // double-check after lock
                var module = await _jsRuntime.InvokeAsync<IJSObjectReference>("import", $"./_content/{_assemblyName}/client.js");
                await module.InvokeVoidAsync($"{IndexedDBJSModuleMethods.InitIndexedDBManager}", _jsConfig);
                _jsModule = module;
                if (_isInProcessRuntime && module is IJSInProcessObjectReference inProcess)
                {
                    _jsInProcessModule = inProcess; // cache synchronous module for faster calls
                }
            }
            finally
            {
                _initLock.Release();
            }
        }

        // Shared JS invoke core used by both CallJavaScript and CallJavaScriptReturnMany to avoid duplication
        private async Task<T> CallJavaScriptCore<T>(IndexedDBJSModuleMethod jsModuleMethod, params object[] args)
        {
            await EnsureModule();
            try
            {
                if (_jsInProcessModule != null)
                {
                    // fast in-process path (Blazor WebAssembly)
                    return _jsInProcessModule.Invoke<T>(jsModuleMethod.QualifiedName, args);
                }
                return await _jsModule!.InvokeAsync<T>(jsModuleMethod.QualifiedName, args);
            }
            catch (JSDisconnectedException)
            {
                _jsModule = null; _jsInProcessModule = null;
                await EnsureModule();
                if (_jsInProcessModule != null)
                {
                    return _jsInProcessModule.Invoke<T>(jsModuleMethod.QualifiedName, args);
                }
                return await _jsModule!.InvokeAsync<T>(jsModuleMethod.QualifiedName, args);
            }
            catch (ObjectDisposedException)
            {
                _jsModule = null; _jsInProcessModule = null;
                await EnsureModule();
                if (_jsInProcessModule != null)
                {
                    return _jsInProcessModule.Invoke<T>(jsModuleMethod.QualifiedName, args);
                }
                return await _jsModule!.InvokeAsync<T>(jsModuleMethod.QualifiedName, args);
            }
        }

        private async Task<IndexedDBActionResult<TResult>> CallJavaScript<TResult>(IndexedDBJSModuleMethod jsModuleMethod, params object[] args)
        {
            return await CallJavaScriptCore<IndexedDBActionResult<TResult>>(jsModuleMethod, args);
        }
        private async Task<List<IndexedDBActionResult<TResult>>> CallJavaScriptReturnMany<TResult>(IndexedDBJSModuleMethod jsModuleMethod, params object[] args)
        {
            return await CallJavaScriptCore<List<IndexedDBActionResult<TResult>>>(jsModuleMethod, args);
        }
        #endregion


        //private void RaiseNotification(IndexDBActionOutcome outcome, string message)
        //{
        //    Console.WriteLine($".NET Outcome: {outcome}, Message: {message}");
        //    ActionCompleted?.Invoke(this, new IndexedDBNotificationEvent { Outcome = outcome, Message = message });
        //}

        [JSInvokable]
        public void RaiseNotificationFromJS(IndexedDBActionResult<object> result)
        {
            if (_logger.IsEnabled(LogLevel.Information))
            {
                _logger.LogInformation("JS Outcome: {OutcomeType}, Message: {Message}", result.Type, result.Message);
            }
            ActionCompleted?.Invoke(this, result);
        }
    }
}
