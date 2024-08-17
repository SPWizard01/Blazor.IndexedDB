namespace Blazor.IndexedDB.Models.Query
{
    /// <summary>
    /// Returns a new IDBKeyRange spanning from lower to upper. 
    /// If lowerOpen is true, lower is not included in the range. 
    /// If upperOpen is true, upper is not included in the range.
    /// <para>
    /// <seealso href="https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange/bound_static">MDN Reference</seealso>
    /// </para>
    /// </summary>
    public sealed class IDBBoundQuery(object Lower, object Upper, bool LowerOpen = false, bool UpperOpen = false) : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.BoundQuery;
        public object Lower { get; } = Lower;
        public object Upper { get; } = Upper;
        public bool LowerOpen { get; } = LowerOpen;
        public bool UpperOpen { get; } = UpperOpen;
        public object TValue { get; set; } = "";
    }
}
