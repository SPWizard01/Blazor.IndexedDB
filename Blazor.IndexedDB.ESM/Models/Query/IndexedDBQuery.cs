namespace Blazor.IndexedDB.ESM.Models.Query
{
    public class IndexedDBQuery(IIndexedDBQuery query, string indexName = "") : IndexedDBObjectBase
    {
        public string IndexName { get; set; } = indexName;

        public object QueryValue { get; set; } = query;

    }
}
