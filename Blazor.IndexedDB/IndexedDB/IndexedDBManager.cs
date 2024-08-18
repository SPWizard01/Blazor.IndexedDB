using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Models.JS;
using Blazor.IndexedDB.Models.Query;
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

                await GetCurrentDbState(db.Name);
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
        public async Task DeleteDb(string dbName)
        {
            if (string.IsNullOrEmpty(dbName))
            {
                throw new ArgumentException("dbName cannot be null or empty", nameof(dbName));
            }
            var result = await CallJavaScript<string?>(IndexedDBJSModuleMethod.DeleteDb, dbName);

        }

        public async Task GetCurrentDbState(string dbName)
        {
            var _dbStore = DBStore.First(s => s.Name == dbName);
            var result = await CallJavaScript<DBInformation>(IndexedDBJSModuleMethod.GetDbInfo, dbName);

            if (result.Data?.Version > _dbStore.Version)
            {
                _dbStore.Version = result.Data.Version;

                var currentStores = _dbStore.Stores.Select(s => s.Name);

                foreach (var storeName in result.Data.StoreNames)
                {
                    if (!currentStores.Contains(storeName))
                    {
                        _dbStore.Stores.Add(new StoreSchema { Name = storeName });

                    }
                }
            }
        }

        /// <summary>
        /// This function provides the means to add a store to an existing database,
        /// </summary>
        /// <param name="storeSchema"></param>
        /// <returns></returns>
        public async Task AddNewStore(string dbName, StoreSchema storeSchema)
        {
            if (storeSchema == null)
            {
                return;
            }
            var _dbStore = DBStore.First(s => s.Name == dbName);
            if (_dbStore.Stores.Any(s => s.Name == storeSchema.Name))
            {
                return;
            }

            _dbStore.Stores.Add(storeSchema);
            _dbStore.Version += 1;

            var result = await CallJavaScript<string>(IndexedDBJSModuleMethod.OpenDb, _dbStore);
            _isOpen = true;

            RaiseNotification(IndexDBActionOutcome.TableCreated, $"new store {storeSchema.Name} added");
        }

        /// <summary>
        /// Adds a new record/object to the specified store
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToAdd">An instance of StoreRecord that provides the store name and the data to add</param>
        /// <returns></returns>

        public async Task<IndexedDBActionResult<T>> AddRecord<T>(string dbName, StoreRecord<T> recordToAdd)
        {
            return await CallJavaScript<T>(IndexedDBJSModuleMethod.AddRecord, dbName, recordToAdd);
        }

        /// <summary>
        /// Updates and existing record
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToUpdate">An instance of StoreRecord with the store name and the record to update</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<T>> UpdateRecord<T>(string dbName, StoreRecord<T> recordToUpdate)
        {
            return await CallJavaScript<T>(IndexedDBJSModuleMethod.UpdateRecord, dbName, recordToUpdate);

        }

        /// <summary>
        /// Retrieve a record by id
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="storeName">The name of the  store to retrieve the record from</param>
        /// <param name="id">the id of the record</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecordById<TInput, TResult>(string storeName, TInput id)
        {

            var data = new { Storename = storeName, Id = id };
            try
            {
                var record = await CallJavaScript<TResult>(IndexedDBJSModuleMethod.GetRecordById, storeName, id!);

                return record;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
                return default;
            }
        }

        /// <summary>
        /// Deletes all records from the store that match the query
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <param name="storeName"></param>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task DeleteRecordByQuery(string dbName, string storeName, IndexedDBRangeQuery query)
        {
            try
            {
                await CallJavaScript<string>(IndexedDBJSModuleMethod.DeleteRecordByQuery, dbName, storeName, query);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
            }
        }

        /// <summary>
        /// Deletes a record from the store based on the id
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <param name="storeName"></param>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task DeleteRecordByKey(string dbName, string storeName, IDBValidKeyQuery<object> key)
        {
            try
            {
                await CallJavaScript<string>(IndexedDBJSModuleMethod.DeleteRecordByKey, dbName, storeName, key);
                RaiseNotification(IndexDBActionOutcome.RecordDeleted, $"Deleted from {storeName} record: {key}");
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
            }
        }

        /// <summary>
        /// Clears all of the records from a given store.
        /// </summary>
        /// <param name="storeName">The name of the store to clear the records from</param>
        /// <returns></returns>
        public async Task ClearStore(string dbName, string storeName)
        {
            if (string.IsNullOrEmpty(storeName))
            {
                throw new ArgumentException("Parameter cannot be null or empty", nameof(storeName));
            }

            try
            {
                var result = await CallJavaScript<string?>(IndexedDBJSModuleMethod.ClearStore, dbName, storeName);
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
        public async Task<IndexedDBActionResult<TResult>> IterateRecordsByIndex<TResult>(IIndexedDBQuery searchQuery, IndexedDBDirection direction)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.IterateRecordsByIndex, searchQuery, direction);
        }


        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBSearch">an instance of IndexedDBSearch</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecordByIndex<TInput, TResult>(IndexedDBSearch searchQuery)
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
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllRecordsByIndexQuery<TInput, TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByIndexQuery, searchQuery);
        }

        /// <summary>
        /// Gets all of the records in the specified index.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllRecordsByIndex<TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByIndex, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys in the specified index that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllKeysByIndex<TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllKeysByIndex, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys in the specified index that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetKeyByIndex<TResult>(IndexedDBSearch searchQuery)
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
        public async Task<IndexedDBActionResult<TResult>> IterateRecords<TResult>(IIndexedDBQuery searchQuery, IndexedDBDirection direction)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.IterateRecords, searchQuery, direction);
        }


        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <param name="searchQuery" cref="IndexedDBSearch">an instance of IndexedDBSearch</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecord<TInput, TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<TResult>(IndexedDBJSModuleMethod.GetRecordByIndex, searchQuery);
        }

        /// <summary>
        /// Gets all of the records that match a given query
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllRecordsByQuery<TInput, TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByQuery, searchQuery);
        }

        /// <summary>
        /// Gets all of the records in the specified store.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllRecords<TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllRecords, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllKeys<TResult>(IndexedDBSearch searchQuery)
        {
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetAllKeys, searchQuery);
        }

        /// <summary>
        /// Gets all of the keys that match the query
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetKey<TResult>(IndexedDBSearch searchQuery)
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
