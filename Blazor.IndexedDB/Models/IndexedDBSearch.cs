using Blazor.IndexedDB.Models.Query;

namespace Blazor.IndexedDB.Models
{
    public class IndexedDBRangeQuery(IIndexedDBQuery query)
    {
        /// <summary>
        /// The value to search for
        /// </summary>
        public object QueryValue { get; set; } = query;
    }

    public class IndexedDBSearch : IndexedDBRangeQuery
    {
        public IndexedDBSearch(string storeName, string indexName, IIndexedDBQuery query) : base(query)
        {
            StoreName = storeName;
            IndexName = indexName;

        }
        /// <summary>
        /// The name of store that the index query will run against
        /// </summary>
        public string StoreName { get; set; }

        /// <summary>
        /// The name of the index to use for the query
        /// </summary>
        public string IndexName { get; set; }

    }
}