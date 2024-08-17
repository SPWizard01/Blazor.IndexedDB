using Blazor.IndexedDB.Models;
using Blazor.IndexedDB.Models.JS;
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
        private readonly DbStore _dbStore;
        private readonly IJSRuntime _jsRuntime;
        private readonly DotNetObjectReference<IndexedDBManager> _dbManagerRef;
        private bool _isOpen;
        private IJSObjectReference? _jsModule;

        /// <summary>
        /// A notification event that is raised when an action is completed
        /// </summary>
        public event EventHandler<IndexedDBNotificationEvent> ActionCompleted = (a, b) => { };

        public IndexedDBManager(DbStore dbStore, IJSRuntime jsRuntime)
        {
            _dbStore = dbStore;
            _jsRuntime = jsRuntime;
            _dbManagerRef = DotNetObjectReference.Create(this);
        }

        public List<StoreSchema> Stores => _dbStore.Stores;
        public int CurrentVersion => _dbStore.Version;
        public string DbName => _dbStore.DbName;

        /// <summary>
        /// Opens the IndexedDB defined in the DbStore. Under the covers will create the database if it does not exist
        /// and create the stores defined in DbStore.
        /// </summary>
        /// <returns></returns>
        public async Task OpenDb()
        {
            try
            {

                var result = await CallJavaScriptReturnMany<string?>(IndexedDBJSModuleMethod.OpenDb, _dbStore);
                _isOpen = true;

                await GetCurrentDbState();
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

        public async Task GetCurrentDbState()
        {
            await EnsureDbOpen();

            var result = await CallJavaScript<DBInformation>(IndexedDBJSModuleMethod.GetDbInfo, _dbStore.DbName);

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
        public async Task AddNewStore(StoreSchema storeSchema)
        {
            if (storeSchema == null)
            {
                return;
            }

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
        public async Task<IndexedDBActionResult<T>> AddRecord<T>(StoreRecord<T> recordToAdd)
        {
            await EnsureDbOpen();
            return await CallJavaScript<StoreRecord<T>, T>(IndexedDBJSModuleMethod.AddRecord, recordToAdd);
        }

        /// <summary>
        /// Updates and existing record
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="recordToUpdate">An instance of StoreRecord with the store name and the record to update</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<T>> UpdateRecord<T>(StoreRecord<T> recordToUpdate)
        {
            await EnsureDbOpen();
            return await CallJavaScript<StoreRecord<T>, T>(IndexedDBJSModuleMethod.UpdateRecord, recordToUpdate);

        }

        /// <summary>
        /// Gets all of the records in a given store.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="storeName">The name of the store from which to retrieve the records</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetRecords<TResult>(string storeName)
        {
            await EnsureDbOpen();
            return await CallJavaScript<IList<TResult>>(IndexedDBJSModuleMethod.GetRecords, storeName);

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
            await EnsureDbOpen();

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
        /// Deletes a record from the store based on the id
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <param name="storeName"></param>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task DeleteRecord<TInput>(string storeName, TInput id)
        {
            try
            {
                await CallJavaScript<string>(IndexedDBJSModuleMethod.DeleteRecord, storeName, id);
                RaiseNotification(IndexDBActionOutcome.RecordDeleted, $"Deleted from {storeName} record: {id}");
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
        public async Task ClearStore(string storeName)
        {
            if (string.IsNullOrEmpty(storeName))
            {
                throw new ArgumentException("Parameter cannot be null or empty", nameof(storeName));
            }

            try
            {
                var result = await CallJavaScript<string, string?>(IndexedDBJSModuleMethod.ClearStore, storeName);
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);

            }

        }

        /// <summary>
        /// Returns the first record that matches a query against a given index
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery">an instance of StoreIndexQuery</param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<TResult>> GetRecordByIndex<TInput, TResult>(StoreIndexQuery<TInput> searchQuery)
        {
            await EnsureDbOpen();

            try
            {
                var result = await CallJavaScript<StoreIndexQuery<TInput>, TResult>(IndexedDBJSModuleMethod.GetRecordByIndex, searchQuery);
                return result;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
                return default;
            }
        }

        /// <summary>
        /// Gets all of the records that match a given query in the specified index.
        /// </summary>
        /// <typeparam name="TInput"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="searchQuery"></param>
        /// <returns></returns>
        public async Task<IndexedDBActionResult<IList<TResult>>> GetAllRecordsByIndex<TInput, TResult>(StoreIndexQuery<TInput> searchQuery)
        {
            await EnsureDbOpen();
            try
            {
                var results = await CallJavaScript<StoreIndexQuery<TInput>, IList<TResult>>(IndexedDBJSModuleMethod.GetAllRecordsByIndex, searchQuery);
                RaiseNotification(IndexDBActionOutcome.Success,
                    $"Retrieved {results.Data?.Count} records, for {searchQuery.QueryValue} on index {searchQuery.IndexName}");
                return results;
            }
            catch (JSException jse)
            {
                RaiseNotification(IndexDBActionOutcome.Failure, jse.Message);
                return default;
            }
        }

        #region JSInterop
        private async Task EnsureModule()
        {
            if (_jsModule != null) return;
            var assemblyName = GetType().Assembly.GetName().Name;
            _jsModule = await _jsRuntime.InvokeAsync<IJSObjectReference>("import", $"./_content/{assemblyName}/client.js");
            await _jsModule.InvokeVoidAsync($"{IndexedDBJSModuleMethod.InitIndexedDBManager}", _dbManagerRef);
        }

        private async Task<IndexedDBActionResult<TResult>> CallJavaScript<TData, TResult>(IndexedDBJSModuleMethod functionName, TData data)
        {
            await EnsureModule();
            return await _jsModule!.InvokeAsync<IndexedDBActionResult<TResult>>($"IDBManager.{functionName}", data);
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

        private async Task CallJavaScriptVoid<TData>(IndexedDBJSModuleMethod functionName, TData data)
        {
            await EnsureModule();
            await _jsModule!.InvokeVoidAsync($"IDBManager.{functionName}", data);
        }

        private async Task CallJavaScriptVoid(IndexedDBJSModuleMethod functionName, params object[] args)
        {
            await EnsureModule();
            await _jsModule!.InvokeVoidAsync($"IDBManager.{functionName}", args);
        }
        #endregion
        private async Task EnsureDbOpen()
        {
            if (!_isOpen) await OpenDb();
        }
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
