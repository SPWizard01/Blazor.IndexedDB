using Blazor.IndexedDB.ESM.Models.Record;
using System.Text.Json.Serialization;

namespace Blazor.IndexedDB.ESM.Models.JS
{
    public class IndexedDBActionResult<T>
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }
        [JsonPropertyName("result")]
        public required IndexedDBRecord<T> Result { get; set; }
        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        public IndexedDBActionResult<object?> ToObject()
        {
            return
                new IndexedDBActionResult<object?>()
                {
                    Success = this.Success,
                    Result = new IndexedDBRecord<object?>
                    {
                        DatabaseName = this.Result.DatabaseName,
                        StoreName = this.Result.StoreName,
                        Data = this.Result.Data
                    },
                    Message = this.Message,
                    Type = this.Type
                };
        }

    }
}