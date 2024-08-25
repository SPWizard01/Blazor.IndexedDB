using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Models.JS;
using Blazor.IndexedDB.Models.Query;
using Blazor.IndexedDB.Models.Record;
using Microsoft.JSInterop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Blazor.IndexedDB
{
    /// <summary>
    /// Provides functionality for accessing IndexedDB from Blazor application
    /// </summary>
    public class IndexedDBManager
    {
        private readonly IJSRuntime _jsRuntime;
        private readonly DotNetObjectReference<IndexedDBManager> _dbManagerRef;
        private IJSObjectReference? _jsModule;
        private IndexedDBJSConfig _jsConfig;

        /// <summary>
        /// A notification event that is raised when an action is completed
        /// </summary>
        public event EventHandler<IndexedDBActionResult<object>>? ActionCompleted;

        /// <summary>
        /// A collection of IndexedDB databases that are defined in the application
        /// </summary>
        public IndexedDBManagerConfig ManagerConfig { get; }

        public IndexedDBManager(IndexedDBManagerConfig managerConfig, IJSRuntime jsRuntime)
        {
            _jsRuntime = jsRuntime;
            _dbManagerRef = DotNetObjectReference.Create(this);
            _jsConfig = new IndexedDBJSConfig
            {
                DotNetReference = _dbManagerRef,
                SendNotifications = managerConfig.Config.SendNotifications,
                SendNotificationsFromJS = managerConfig.Config.SendNotificationsFromJS
            };
            ManagerConfig = managerConfig;
        }
        /// <summary>
        /// Opens the IndexedDB defined in the DbStore. Under the covers will create the database if it does not exist
        /// and create the stores defined in DbStore.
        /// </summary>
        /// <returns></returns>
        public Task<List<IndexedDBActionResult<string?>>> OpenDb(string dbName)
        {
            return OpenDb(ManagerConfig.Databases.First(s => s.Name == dbName));
        }
        public async Task<List<IndexedDBActionResult<string?>>> OpenDb(IndexedDBDatabase db)
        {
            return await CallJavaScriptReturnMany<string?>(IndexedDBJSModuleMethod.OpenDb, db);

        }

        /// <summary>
        /// Deletes the database corresponding to the dbName passed in
        /// </summary>
        /// <param name="dbName">The name of database to delete</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> DeleteDb(IndexedDBDatabase db)
        {
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.DeleteDb, db.Name);
        }

        //TODO: Refactor
        public async Task GetDatabaseInfo(IndexedDBDatabase db)
        {
            var result = await CallJavaScript<DBInformation>(IndexedDBJSModuleMethod.GetDatabaseInfo, db.Name);

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

            var result = await CallJavaScript<string>(IndexedDBJSModuleMethod.OpenDb, db.Name);

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
            return await CallJavaScript<T>(IndexedDBJSModuleMethod.AddRecord, recordToAdd);
        }

        /// <summary>
        /// Updates and existing record
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToUpdate">An instance of StoreRecord with the store name and the record to update</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<T>> UpdateRecord<T>(IndexedDBRecordAction<T> recordToUpdate)
        {
            return await CallJavaScript<T>(IndexedDBJSModuleMethod.UpdateRecord, recordToUpdate);

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
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.DeleteRecord, query);
        }



        /// <summary>
        /// Clears all of the records from a given store.
        /// </summary>
        /// <param name="storeName">The name of the store to clear the records from</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<string?>> ClearStore(IndexedDBObjectBase target)
        {

            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.ClearStore, target);

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
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.OpenCursor, searchQuery, direction);
        }

        /// <summary>
        /// Advances the cursor to the next record that matches the query, the query should be the same as the one used in OpenCursor
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> AdvanceCursor<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.AdvanceCursor, searchQuery);
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
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.CloseCursor, searchQuery);
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
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.CloseAllStoreCursors, searchQuery);
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
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.CloseAllCursors, searchQuery);
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
            return await CallJavaScript<string?>(IndexedDBJSModuleMethod.CloseAllCursors, new IndexedDBObjectBase() { DatabaseName = databaseName, StoreName = "" });
        }


        /// <summary>
        /// Iterates over all of the records in a given store (and index if supplied) that match a query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> IterateRecords<TResult>(IndexedDBQuery searchQuery, IndexedDBDirection? direction = null)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.IterateRecords, searchQuery, direction);
        }


        /// <summary>
        /// Returns the first record that matches a query
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBQuery">an instance of IndexedDBQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecord<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.GetRecord, searchQuery);
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
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllRecords, searchQuery, count);
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
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllKeys, searchQuery, count);
        }

        /// <summary>
        /// Gets first primary key that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetKey<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetKey, searchQuery);
        }
        #endregion


        #region JSInterop
        private async Task EnsureModule()
        {
            if (_jsModule != null) return;
            var assemblyName = GetType().Assembly.GetName().Name;
            _jsModule = await _jsRuntime.InvokeAsync<IJSObjectReference>("import", $"./_content/{assemblyName}/client.js");
            await _jsModule.InvokeVoidAsync($"{IndexedDBJSModuleMethod.InitIndexedDBManager}", _jsConfig);
        }

        private async Task<IndexedDBActionResult<TResult>> CallJavaScript<TResult>(IndexedDBJSModuleMethod functionName, params object[] args)
        {
            await EnsureModule();
            return await _jsModule!.InvokeAsync<IndexedDBActionResult<TResult>>($"IDBManager.{functionName}", args);
        }
        private async Task<List<IndexedDBActionResult<TResult>>> CallJavaScriptReturnMany<TResult>(IndexedDBJSModuleMethod functionName, params object[] args)
        {
            await EnsureModule();
            return await _jsModule!.InvokeAsync<List<IndexedDBActionResult<TResult>>>($"IDBManager.{functionName}", args);
        }

        private async Task CallJavaScriptVoid(IndexedDBJSModuleMethod functionName, params object[] args)
        {
            await EnsureModule();
            await _jsModule!.InvokeVoidAsync($"IDBManager.{functionName}", args);
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
#if DEBUG
            Console.WriteLine($"JS Outcome: {result.Type}, Message: {result.Message}");
#endif
            ActionCompleted?.Invoke(this, result);
        }
    }
}
