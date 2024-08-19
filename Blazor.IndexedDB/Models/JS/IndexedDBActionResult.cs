using Blazor.IndexedDB.Models.Record;
using System.Text.Json.Serialization;

namespace Blazor.IndexedDB.Models.JS
{
    public class IndexedDBActionResult<T>
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }
        [JsonPropertyName("result")]
        public IndexedDBRecord<T> Result { get; set; }
        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;
    }

}