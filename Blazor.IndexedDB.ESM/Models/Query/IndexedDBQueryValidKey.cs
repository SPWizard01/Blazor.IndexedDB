namespace Blazor.IndexedDB.ESM.Models.Query
{
    /// <summary>
    /// Returns a new IDBValidKey with key referring to primary key
    /// <para>
    /// <seealso href="https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/primaryKey">MDN Reference</seealso>
    /// </para>
    /// </summary>
    public sealed class IndexedDBQueryValidKey(object keyValue) : IIndexedDBQuery// where T : struct
    {
        public object Value { get; set; } = keyValue;
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.ValidKeyQuery;
    }
}
