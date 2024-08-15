namespace Blazor.IndexedDB
{

    /// <summary>
    /// Constants defining the JavaScript functions that can be called.
    /// </summary>
    public class IndexedDBJSModuleMethod
    {
        private IndexedDBJSModuleMethod(string value) { Value = value; }

        public string Value { get; private set; }
        public static IndexedDBJSModuleMethod InitIndexedDBManager { get; } = new("initIndexedDbManager");
        public static IndexedDBJSModuleMethod CreateDb { get; } = new("createDb");
        public static IndexedDBJSModuleMethod DeleteDb { get; } = new("deleteDb");
        public static IndexedDBJSModuleMethod AddRecord { get; } = new("addRecord");
        public static IndexedDBJSModuleMethod UpdateRecord { get; } = new("updateRecord");
        public static IndexedDBJSModuleMethod GetRecords { get; } = new("getRecords");
        public static IndexedDBJSModuleMethod OpenDb { get; } = new("openDb");
        public static IndexedDBJSModuleMethod DeleteRecord { get; } = new("deleteRecord");
        public static IndexedDBJSModuleMethod GetRecordById { get; } = new("getRecordById");
        public static IndexedDBJSModuleMethod ClearStore { get; } = new("clearStore");
        public static IndexedDBJSModuleMethod GetRecordByIndex { get; } = new("getRecordByIndex");
        public static IndexedDBJSModuleMethod GetAllRecordsByIndex { get; } = new("getAllRecordsByIndex");
        public static IndexedDBJSModuleMethod GetDbInfo { get; } = new("getDbInfo");

        public override string ToString()
        {
            return Value;
        }
    }
}