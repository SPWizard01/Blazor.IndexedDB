namespace Blazor.IndexedDB.Models.Query
{
    /// <summary>
    /// Returns a new IDBKeyRange spanning only key.
    /// <para>
    /// <seealso href="https://developer.mozilla.org/docs/Web/API/IDBKeyRange/only_static">MDN Reference</seealso>
    /// </para>
    /// </summary>
    public sealed class IndexedDBQueryOnly(object value) : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.OnlyQuery;
        public object Value { get; } = value;
    }
}
