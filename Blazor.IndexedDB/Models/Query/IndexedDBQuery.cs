using System;

namespace Blazor.IndexedDB.Models.Query
{
    public interface IIndexedDBQuery
    {
        public IndexedDBQueryType QueryType { get; set; }
        //public object TValue { get; set; }
    }

    public sealed class IndexedDBQuery
    {
        public static IDBBoundQuery Bound(object Lower, object Upper, bool LowerOpen = false, bool UpperOpen = false)
        {
            return new IDBBoundQuery(Lower, Upper, LowerOpen, UpperOpen);
        }

        public static IDBLowerBoundQuery LowerBound(object Lower, bool LowerOpen = false)
        {
            return new IDBLowerBoundQuery(Lower, LowerOpen);
        }

        public static IDBUpperBoundQuery UpperBound(object Upper, bool UpperOpen = false)
        {
            return new IDBUpperBoundQuery(Upper, UpperOpen);
        }

        public static IDBOnlyQuery Only(object value)
        {
            return new IDBOnlyQuery(value);
        }






        public static IDBValidKeyQuery<string?> ValidKeyQuery(string value)
        {
            return new IDBValidKeyQuery<string?>(value);
        }
        public static IDBValidKeyQuery<int?> ValidKeyQuery(int value)
        {
            return new IDBValidKeyQuery<int?>(value);
        }
        public static IDBValidKeyQuery<long?> ValidKeyQuery(long value)
        {
            return new IDBValidKeyQuery<long?>(value);
        }
        public static IDBValidKeyQuery<DateTime?> ValidKeyQuery(DateTime value)
        {
            return new IDBValidKeyQuery<DateTime?>(value);
        }
        public static IDBValidKeyQuery<DateTimeOffset?> ValidKeyQuery(DateTimeOffset value)
        {
            return new IDBValidKeyQuery<DateTimeOffset?>(value);
        }
        public static IDBValidKeyQuery<byte[]?> ValidKeyQuery(byte[] value)
        {
            return new IDBValidKeyQuery<byte[]?>(value);
        }


        public static IDBValidKeyQuery<string[]> ValidKeyQuery(string[] value)
        {
            return new IDBValidKeyQuery<string[]>(value);
        }
        public static IDBValidKeyQuery<int[]> ValidKeyQuery(int[] value)
        {
            return new IDBValidKeyQuery<int[]>(value);
        }
        public static IDBValidKeyQuery<long[]> ValidKeyQuery(long[] value)
        {
            return new IDBValidKeyQuery<long[]>(value);
        }
        public static IDBValidKeyQuery<DateTime[]> ValidKeyQuery(DateTime[] value)
        {
            return new IDBValidKeyQuery<DateTime[]>(value);
        }
        public static IDBValidKeyQuery<DateTimeOffset[]> ValidKeyQuery(DateTimeOffset[] value)
        {
            return new IDBValidKeyQuery<DateTimeOffset[]>(value);
        }
        public static IDBValidKeyQuery<byte[][]> ValidKeyQuery(byte[][] value)
        {
            return new IDBValidKeyQuery<byte[][]>(value);
        }
    }
}
