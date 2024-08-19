namespace Blazor.IndexedDB.Models.Query
{
    /// <summary>
    /// Returns a new IDBKeyRange with no lower bound and ending at key. If open is true, key is not included in the range.
    /// <para>
    /// <seealso href="https://developer.mozilla.org/docs/Web/API/IDBKeyRange/upperBound_static">MDN Reference</seealso>
    /// </para>
    /// </summary>
    public sealed class IndexedDBQueryUpperBound(object Upper, bool UpperOpen = false) : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.UpperBoundQuery;
        public object Upper { get; } = Upper;
        public bool UpperOpen { get; } = UpperOpen;
    }
}
