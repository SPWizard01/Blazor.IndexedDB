using Blazor.IndexedDB.Models.Query;

namespace Blazor.IndexedDB.Models
{

    public class IndexedDBSearch(string storeName, string indexName, IIndexedDBQuery query)
    {
        /// <summary>
        /// The name of store that the index query will run against
        /// </summary>
        public string StoreName { get; set; } = storeName;

        /// <summary>
        /// The name of the index to use for the query
        /// </summary>
        public string IndexName { get; set; } = indexName;

        /// <summary>
        /// The value to search for
        /// </summary>
        public object QueryValue { get; set; } = query;
    }
}