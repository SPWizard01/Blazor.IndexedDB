using System;

namespace Blazor.IndexedDB.ESM
{

    /// <summary>
    /// Represents a single JavaScript method that can be called in the IndexedDB module.
    /// </summary>
    public sealed class IndexedDBJSModuleMethod : IEquatable<IndexedDBJSModuleMethod>
    {
        internal IndexedDBJSModuleMethod(string value) { Value = value; }

        public string Value { get; }

        /// <summary>
        /// Fully qualified JS method name with the IDBManager prefix.
        /// </summary>
        public string QualifiedName => $"IDBManager.{Value}";

        public override string ToString() => Value;

        // Equality members to allow comparisons and dictionary/set usage
        public bool Equals(IndexedDBJSModuleMethod? other) => other is not null && (ReferenceEquals(this, other) || Value == other.Value);
        public override bool Equals(object? obj) => obj is IndexedDBJSModuleMethod other && Equals(other);
        public override int GetHashCode() => Value.GetHashCode(StringComparison.Ordinal);
        public static bool operator ==(IndexedDBJSModuleMethod? left, IndexedDBJSModuleMethod? right) => Equals(left, right);
        public static bool operator !=(IndexedDBJSModuleMethod? left, IndexedDBJSModuleMethod? right) => !Equals(left, right);

        // Convenience conversion to string
        public static implicit operator string(IndexedDBJSModuleMethod method) => method.Value;
    }
}