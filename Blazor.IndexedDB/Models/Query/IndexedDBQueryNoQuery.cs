namespace Blazor.IndexedDB.Models.Query
{
    public sealed class IndexedDBQueryNoQuery : IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; } = IndexedDBQueryType.NoQuery;
    }
}
