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
    public sealed class IDBValidKeyQuery<T>(T keyValue) : IIndexedDBQuery// where T : struct
    {
        public T Value { get; set; } = keyValue;
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.ValidKeyQuery;
    }
}
