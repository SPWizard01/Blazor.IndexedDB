namespace Blazor.IndexedDB.Models.Query
{
    public class IndexedDBQuery(IIndexedDBQuery query) : IndexedDBObjectBase
    {
        public object QueryValue { get; set; } = query;

    }
}
