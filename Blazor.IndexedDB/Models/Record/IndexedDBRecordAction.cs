using Blazor.IndexedDB.Models.Query;

namespace Blazor.IndexedDB.Models.Record
{
    public class IndexedDBRecordAction<T> : IndexedDBQuery
    {
        public IndexedDBRecordAction(IIndexedDBQuery query) : base(query)
        {
        }
        public T? Data { get; set; }
        /// <summary>
        /// Should be set to true of the object does not use inline keys.
        /// <para>
        /// Check <see href="https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/put#exceptions">MDN Reference</see>
        /// </para>
        /// </summary>
        public bool UseKey { get; set; }
    }
}
