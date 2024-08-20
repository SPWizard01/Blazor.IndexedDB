namespace Blazor.IndexedDB.Models.Query
{

    public sealed class IndexedDBQueryCreator
    {
        public static IndexedDBQueryBound Bound(object Lower, object Upper, bool LowerOpen = false, bool UpperOpen = false)
        {
            return new IndexedDBQueryBound(Lower, Upper, LowerOpen, UpperOpen);
        }

        public static IndexedDBQueryLowerBound LowerBound(object Lower, bool LowerOpen = false)
        {
            return new IndexedDBQueryLowerBound(Lower, LowerOpen);
        }

        public static IndexedDBQueryUpperBound UpperBound(object Upper, bool UpperOpen = false)
        {
            return new IndexedDBQueryUpperBound(Upper, UpperOpen);
        }

        public static IndexedDBQueryOnly Only(object value)
        {
            return new IndexedDBQueryOnly(value);
        }

        public static IndexedDBQueryValidKey ValidKeyQuery(object value)
        {
            return new IndexedDBQueryValidKey(value);
        }
    }
}
