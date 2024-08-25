using Blazor.IndexedDB.ESM.Models.JS;
using Blazor.IndexedDB.ESM.Models.Query;

namespace Blazor.IndexedDB.ESM.Server
{
    public static class HelperMethods
    {

        public static object GetConvertedValue(string selectedSearchValueType, string value)
        {
            object convertedValue = value;

            switch (selectedSearchValueType)
            {
                case "string":
                    convertedValue = value;
                    break;
                case "number":
                    convertedValue = long.Parse(value);
                    break;
                case "datetime":
                    convertedValue = DateTime.Parse(value);
                    break;
                case "datetimeoffset":
                    convertedValue = DateTimeOffset.Parse(value);
                    break;
                case "arrayofobjects":
                    convertedValue = value.Split(',').Select(s => (object)s);
                    break;
            }
            return convertedValue;
        }
        public static async Task<IndexedDBActionResult<object?>?> SearchForRecords(IndexedDBManager DbManager, string selectedMethod, string selectedDatabase, string selectedStore, string selectedIndex, IIndexedDBQuery? queryValue)
        {


            if (queryValue == null) return null;

            var query = new IndexedDBQuery(queryValue, selectedIndex) { DatabaseName = selectedDatabase, StoreName = selectedStore };


            if (query == null) return null;
            switch (selectedMethod)
            {
                case "openCursor":
                    return await DbManager.OpenCursor<object?>(query);
                case "advanceCursor":
                    return await DbManager.AdvanceCursor<object?>(query);
                case "closeCursor":
                    return (await DbManager.CloseCursor(query)).ToObject();
                case "closeAllStoreCursors":
                    return (await DbManager.CloseAllStoreCursors(query)).ToObject();
                case "closeAllCursors":
                    return (await DbManager.CloseAllCursors(query)).ToObject();
                case "iterateRecords":
                    return await DbManager.IterateRecords<object?>(query);
                case "getRecord":
                    return await DbManager.GetRecord<object?>(query);
                case "getAllRecords":
                    return (await DbManager.GetAllRecords<object?>(query)).ToObject(); ;
                case "getAllKeys":
                    return (await DbManager.GetAllKeys<object?>(query)).ToObject();
                case "getKey":
                    return (await DbManager.GetKey<object?>(query)).ToObject();
                default:
                    return null;
            }
        }

        public static IIndexedDBQuery? GetQuery(string selectedQuery, string searchValueType, string simpleValue, string lowerBoundString, string upperBoundString, bool lowerBoundExclude, bool upperBoundExcludeString, string lowerBoundLowerString, bool lowerBoundLowerExclude, string upperBoundUpper, bool upperBoundUpperExclude, string onlyValue)
        {
            IIndexedDBQuery? queryValue = null;
            switch (selectedQuery)
            {
                case "Simple":
                    queryValue = IndexedDBQueryCreator.ValidKeyQuery(GetConvertedValue(searchValueType, simpleValue));
                    break;
                case "Bound":
                    queryValue = IndexedDBQueryCreator.Bound(GetConvertedValue(searchValueType, lowerBoundString), GetConvertedValue(searchValueType, upperBoundString), lowerBoundExclude, upperBoundExcludeString);
                    break;
                case "Lower":
                    queryValue = IndexedDBQueryCreator.LowerBound(GetConvertedValue(searchValueType, lowerBoundLowerString), lowerBoundLowerExclude);
                    break;
                case "Upper":
                    queryValue = IndexedDBQueryCreator.UpperBound(GetConvertedValue(searchValueType, upperBoundUpper), upperBoundUpperExclude);
                    break;
                case "Only":
                    queryValue = IndexedDBQueryCreator.Only(GetConvertedValue(searchValueType, onlyValue));
                    break;
            }
            return queryValue;
        }
    }
}
