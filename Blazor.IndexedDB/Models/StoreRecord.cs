namespace Blazor.IndexedDB.Models
{
    /// <summary>
    /// This class is used when adding or updating a record.
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public class StoreRecord<T>
    {
        /// <summary>
        /// The name of database store in each the record is to be saved
        /// </summary>
        public string StoreName { get; set; }
        /// <summary>
        /// The data/record to save in the store.
        /// </summary>
        public T Data { get; set; }
    }
}