using System;

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






        public static IndexedDBQueryValidKey<string> ValidKeyQuery(string value)
        {
            return new IndexedDBQueryValidKey<string>(value);
        }
        public static IndexedDBQueryValidKey<int> ValidKeyQuery(int value)
        {
            return new IndexedDBQueryValidKey<int>(value);
        }
        public static IndexedDBQueryValidKey<long> ValidKeyQuery(long value)
        {
            return new IndexedDBQueryValidKey<long>(value);
        }
        public static IndexedDBQueryValidKey<object> ValidKeyQuery(object value)
        {
            return new IndexedDBQueryValidKey<object>(value);
        }
        public static IndexedDBQueryValidKey<DateTime> ValidKeyQuery(DateTime value)
        {
            return new IndexedDBQueryValidKey<DateTime>(value);
        }
        public static IndexedDBQueryValidKey<DateTimeOffset> ValidKeyQuery(DateTimeOffset value)
        {
            return new IndexedDBQueryValidKey<DateTimeOffset>(value);
        }
        public static IndexedDBQueryValidKey<byte[]> ValidKeyQuery(byte[] value)
        {
            return new IndexedDBQueryValidKey<byte[]>(value);
        }


        public static IndexedDBQueryValidKey<string[]> ValidKeyQuery(string[] value)
        {
            return new IndexedDBQueryValidKey<string[]>(value);
        }
        public static IndexedDBQueryValidKey<int[]> ValidKeyQuery(int[] value)
        {
            return new IndexedDBQueryValidKey<int[]>(value);
        }
        public static IndexedDBQueryValidKey<long[]> ValidKeyQuery(long[] value)
        {
            return new IndexedDBQueryValidKey<long[]>(value);
        }
        public static IndexedDBQueryValidKey<object[]> ValidKeyQuery(object[] value)
        {
            return new IndexedDBQueryValidKey<object[]>(value);
        }
        public static IndexedDBQueryValidKey<DateTime[]> ValidKeyQuery(DateTime[] value)
        {
            return new IndexedDBQueryValidKey<DateTime[]>(value);
        }
        public static IndexedDBQueryValidKey<DateTimeOffset[]> ValidKeyQuery(DateTimeOffset[] value)
        {
            return new IndexedDBQueryValidKey<DateTimeOffset[]>(value);
        }
        public static IndexedDBQueryValidKey<byte[][]> ValidKeyQuery(byte[][] value)
        {
            return new IndexedDBQueryValidKey<byte[][]>(value);
        }
    }
}
