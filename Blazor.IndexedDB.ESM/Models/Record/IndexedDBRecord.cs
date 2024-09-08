using Blazor.IndexedDB.ESM.Models.Query;
using System.Text.Json;

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

        public IndexedDBRecord<TDest?> Cast<TDest>()
        {
            var newData = this.CastResult<TDest>();
            return new IndexedDBRecord<TDest?>() { Data = newData, DatabaseName = DatabaseName, StoreName = StoreName };
        }

        public TDest? CastResult<TDest>()
        {
            var dt = JsonSerializer.Deserialize<TDest>(JsonSerializer.Serialize(Data));
            return dt;
        }
    }
}
