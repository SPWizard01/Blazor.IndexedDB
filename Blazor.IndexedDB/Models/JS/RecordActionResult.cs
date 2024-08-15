namespace Blazor.IndexedDB.Models.JS
{
    public sealed class RecordActionResult<T>
    {
        public string StoreName { get; set; }
        public int Key { get; set; }
        public T Data { get; set; }
    }
}
