using Blazor.IndexedDB.ESM.Models.Query;

namespace Blazor.IndexedDB.ESM.Models.Record
{
    public class IndexedDBRecord<T> : IndexedDBObjectBase
    {
        /// <summary>
        /// The data/record to save in the store.
        /// </summary>
        public T? Data { get; set; }


        public IndexedDBRecord<TResult> ToRecord<TResult>(TResult data)
        {
            return new IndexedDBRecord<TResult>()
            {
                Data = data,
                DatabaseName = DatabaseName,
                StoreName = StoreName
            };
        }
        public IndexedDBRecordAction<T> ToAction(bool useKey = false)
        {
            return new IndexedDBRecordAction<T>(new IndexedDBQueryNoQuery())
            {
                Data = Data,
                DatabaseName = DatabaseName,
                StoreName = StoreName,
                UseKey = useKey

            };
        }
        public IndexedDBRecordAction<T> ToQueryAction(IIndexedDBQuery query, bool useKey)
        {
            return new IndexedDBRecordAction<T>(query)
            {
                Data = Data,
                DatabaseName = DatabaseName,
                StoreName = StoreName,
                UseKey = useKey

            };
        }
    }
}
