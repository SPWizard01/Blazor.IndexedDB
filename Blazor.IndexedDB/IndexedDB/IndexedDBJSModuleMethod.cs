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
        public static IndexedDBJSModuleMethod DeleteRecord { get; } = new("deleteRecord");
        public static IndexedDBJSModuleMethod UpdateRecord { get; } = new("updateRecord");

        public static IndexedDBJSModuleMethod OpenCursor { get; } = new("openCursor");
        public static IndexedDBJSModuleMethod AdvanceCursor { get; } = new("advanceCursor");
        public static IndexedDBJSModuleMethod CloseCursor { get; } = new("closeCursor");
        public static IndexedDBJSModuleMethod CloseAllStoreCursors { get; } = new("closeAllStoreCursors");
        public static IndexedDBJSModuleMethod CloseAllCursors { get; } = new("closeAllCursors");
        public static IndexedDBJSModuleMethod IterateRecords { get; } = new("iterateRecords");
        public static IndexedDBJSModuleMethod GetRecord { get; } = new("getRecord");
        public static IndexedDBJSModuleMethod GetAllRecords { get; } = new("getAllRecords");
        public static IndexedDBJSModuleMethod GetAllKeys { get; } = new("getAllKeys");
        public static IndexedDBJSModuleMethod GetKey { get; } = new("getKey");



        public static IndexedDBJSModuleMethod GetRecords { get; } = new("getRecords");
        public static IndexedDBJSModuleMethod OpenDb { get; } = new("openDb");
        public static IndexedDBJSModuleMethod ClearStore { get; } = new("clearStore");
        public static IndexedDBJSModuleMethod GetDatabaseInfo { get; } = new("getDatabaseInfo");

        public override string ToString()
        {
            return Value;
        }
    }
}