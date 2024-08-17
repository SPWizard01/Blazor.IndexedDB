using System.Text.Json.Serialization;

namespace Blazor.IndexedDB.Models.Query
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IndexedDBQueryType
    {
        BoundQuery,
        LowerBoundQuery,
        UpperBoundQuery,
        OnlyQuery,
        ValidKeyQuery
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IndexedDBDirection
    {
        Next,
        Nextunique,
        Prev,
        Prevunique
    }
}
