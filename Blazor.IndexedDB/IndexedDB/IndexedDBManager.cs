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
        private bool _isOpen;
        private IJSObjectReference? _jsModule;

        /// <summary>
        /// A notification event that is raised when an action is completed
        /// </summary>
        public event EventHandler<IndexedDBNotificationEvent>? ActionCompleted;

        public IndexedDBManager(IndexedDBDatabaseCollection dbStore, IJSRuntime jsRuntime)
        {
            _jsRuntime = jsRuntime;
            _dbManagerRef = DotNetObjectReference.Create(this);
            DBStore = dbStore;
        }
        public IndexedDBDatabaseCollection DBStore { get; }
        /// <summary>
        /// Opens the IndexedDB defined in the DbStore. Under the covers will create the database if it does not exist
        /// and create the stores defined in DbStore.
        /// </summary>
        /// <returns></returns>
        public Task OpenDb(string dbName)
        {
            return OpenDb(DBStore.First(s => s.Name == dbName));
        }
        public async Task OpenDb(IndexedDBDatabase db)
        {
            try
            {

                var result = await CallJavaScriptReturnMany<string?>(IndexedDBJSModuleMethod.OpenDb, db);
                _isOpen = true;

                await GetCurrentDbState(db);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
            }

        }

        /// <summary>
        /// Deletes the database corresponding to the dbName passed in
        /// </summary>
        /// <param name="dbName">The name of database to delete</param>
        /// <returns></returns>
        public async Task DeleteDb(IndexedDBDatabase db)
        {
            if (string.IsNullOrEmpty(db.Name))
            {
                throw new ArgumentException("Database Name cannot be null or empty");
            }
            var result = await CallJavaScript<string?>(IndexedDBJSModuleMethod.DeleteDb, db.Name);

        }

        public async Task GetCurrentDbState(IndexedDBDatabase db)
        {
            var result = await CallJavaScript<DBInformation>(IndexedDBJSModuleMethod.GetDbInfo, db.Name);

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

        /// <summary>
        /// This function provides the means to add a store to an existing database,
        /// </summary>
        /// <param name="storeSchema"></param>
        /// <returns></returns>
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
            _isOpen = true;

            RaiseNotification(IndexDBActionOutcome.TableCreated, $"new store {storeSchema.Name} added");
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
        public async Task DeleteRecordByQuery(IndexedDBQuery query)
        {
            try
            {
                await CallJavaScript<string>(IndexedDBJSModuleMethod.DeleteRecordByQuery, query);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
            }
        }

        /// <summary>
        /// Deletes a record from the store based on the id
        /// </summary>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<object>> DeleteRecordByKey(IndexedDBQuery record)
        {

            return await CallJavaScript<object>(IndexedDBJSModuleMethod.DeleteRecordByKey, record);
        }

        /// <summary>
        /// Clears all of the records from a given store.
        /// </summary>
        /// <param name="storeName">The name of the store to clear the records from</param>
        /// <returns></returns>
        public async Task ClearStore(IndexedDBDatabase db, string storeName)
        {
            if (string.IsNullOrEmpty(storeName))
            {
                throw new ArgumentException("Parameter cannot be null or empty", nameof(storeName));
            }

            try
            {
                var result = await CallJavaScript<string?>(IndexedDBJSModuleMethod.ClearStore, db.Name, storeName);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);

            }

        }

        #region IndexQueryMethods
        /// <summary>
        /// Iterates over all of the records in a given store that match a query against a given index
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> IterateRecordsByIndex<TResult>(IndexedDBIndexQuery searchQuery, IndexedDBDirection direction)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.IterateRecordsByIndex, searchQuery, direction);
        }




        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBSearch">an instance of IndexedDBSearch</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecordByIndex<TResult>(IndexedDBIndexQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.GetRecordByIndex, searchQuery);
        }

        /// <summary>
        /// Gets all of the records that match a given query in the specified index.
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllRecordsByIndexQuery<TInput, TResult>(IndexedDBIndexQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByIndexQuery, searchQuery, count);
        }

        /// <summary>
        /// Gets all of the records in the specified index.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllRecordsByIndex<TResult>(IndexedDBIndexQuery searchQuery)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByIndex, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys in the specified index that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllKeysByIndex<TResult>(IndexedDBIndexQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllKeysByIndex, searchQuery, count);
        }

        /// <summary>
        /// Gets all of the keys in the specified index that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetKeyByIndex<TResult>(IndexedDBIndexQuery searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetKeyByIndex, searchQuery);
        }
        #endregion

        #region ObjectStoreQueryMethods
        /// <summary>
        /// Iterates over all of the records in a given store that match a query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> IterateRecords<TResult>(IndexedDBQuery searchQuery, IndexedDBDirection direction)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.IterateRecords, searchQuery, direction);
        }


        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBSearch">an instance of IndexedDBSearch</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecord<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.GetRecord, searchQuery);
        }

        /// <summary>
        /// Gets all of the records that match a given query
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllRecordsByQuery<TResult>(IndexedDBQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByQuery, searchQuery, count);
        }

        /// <summary>
        /// Gets all of the records in the specified store.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllRecords<TResult>(IndexedDBQuery searchQuery)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllRecords, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<List<TResult>>> GetAllKeys<TResult>(IndexedDBQuery searchQuery, int count = -1)
        {
            return await CallJavaScript<List<TResult>>(IndexedDBJSModuleMethod.GetAllKeys, searchQuery, count);
        }

        /// <summary>
        /// Gets all of the keys that match the query
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
            await _jsModule.InvokeVoidAsync($"{IndexedDBJSModuleMethod.InitIndexedDBManager}", _dbManagerRef);
        }

        private async Task<IndexedDBActionResult<TResult>> CallJavaScript<TResult>(IndexedDBJSModuleMethod functionName, params object[] args)
        {
            await EnsureModule();
            return await _jsModule!.InvokeAsync<IndexedDBActionResult<TResult>>($"IDBManager.{functionName}", args);
        }
        public async Task<IndexedDBActionResult<TResult>> CallJavaScriptDebug<TResult>(string functionName, params object[] args)
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


        private void RaiseNotification(IndexDBActionOutcome outcome, string message)
        {
            Console.WriteLine($".NET Outcome: {outcome}, Message: {message}");
            ActionCompleted?.Invoke(this, new IndexedDBNotificationEvent { Outcome = outcome, Message = message });
        }

        [JSInvokable]
        public void RaiseNotificationFromJS(string outcome, string message)
        {
            Console.WriteLine($"JS Outcome: {outcome}, Message: {message}");
            ActionCompleted?.Invoke(this, new IndexedDBNotificationEvent { Outcome = Enum.Parse<IndexDBActionOutcome>(outcome), Message = message });
        }
    }
}
