using System.Text.Json.Serialization;

namespace Blazor.IndexedDB.ESM.Models.Query
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IndexedDBQueryType
    {
        NoQuery,
        BoundQuery,
        LowerBoundQuery,
        UpperBoundQuery,
        OnlyQuery,
        ValidKeyQuery,
        ObjectQuery,
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IndexedDBDirection
    {
        Next,
        Nextunique,
        Prev,
        Prevunique
    }

    public interface IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; }
        //public object TValue { get; set; }
    }
}
