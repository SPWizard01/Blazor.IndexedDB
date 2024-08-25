namespace Blazor.IndexedDB.ESM.Models.Query
{
    public sealed class IndexedDBQueryNoQuery : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.NoQuery;
    }
}
