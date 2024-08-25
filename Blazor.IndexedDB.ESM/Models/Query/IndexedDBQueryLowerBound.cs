namespace Blazor.IndexedDB.ESM.Models.Query
{
    /// <summary>
    /// Returns a new IDBKeyRange starting at key with no upper bound. If open is true, key is not included in the range.
    /// <para>
    /// <seealso href="https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange/lowerBound_static">MDN Reference</seealso>
    /// </para>
    /// </summary>
    public sealed class IndexedDBQueryLowerBound(object Lower, bool LowerOpen = false) : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.LowerBoundQuery;
        public object LowerBound { get; } = Lower;
        public bool LowerOpen { get; } = LowerOpen;
    }
}
