namespace Blazor.IndexedDB.Models.Query
{
    public class IndexedDBIndexQuery : IndexedDBQuery
    {
        public string IndexName { get; set; }
        public IndexedDBIndexQuery(string indexName, IIndexedDBQuery query) : base(query)
        {
            IndexName = indexName;
        }
    }
}
