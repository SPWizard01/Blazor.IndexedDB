namespace Blazor.IndexedDB.Models
{
    public class IndexedDBObjectBase
    {
        public required string DatabaseName { get; set; }
        public required string StoreName { get; set; }
    }
}
