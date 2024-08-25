namespace Blazor.IndexedDB.ESM.Models.JS
{
    public class DBInformation
    {
        public string Name { get; set; } = string.Empty;
        public int Version { get; set; }
        public string[] StoreNames { get; set; } = [];
    }
}
