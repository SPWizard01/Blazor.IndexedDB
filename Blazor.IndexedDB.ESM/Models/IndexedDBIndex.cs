namespace Blazor.IndexedDB.ESM.Models
{
    /// <summary>
    /// Defines an Index for a given object store.
    /// </summary>
    public class IndexedDBIndex
    {
        /// <summary>
        /// The name of the index.
        /// </summary>
        public required string Name { get; set; }

        /// <summary>
        /// the identifier for the property in the object/record that is saved and is to be indexed.
        /// </summary>
        public required string[] KeyPath { get; set; }
        /// <summary>
        /// If true, the index will be created as an array instead of a string when KeyPath has only one value.
        /// <para>Default is false.</para>
        /// </summary>
        public bool KeepAsArrayOnSingleValue { get; set; }
        /// <summary>
        /// Should be set to true when keyPath references an array of values.
        /// Will throw an error if keyPath is an array with more than 1 value.
        /// </summary>
        public bool MultiEntry { get; set; }
        /// <summary>
        /// defines whether the key value must be unique
        /// </summary>
        public bool Unique { get; set; }

        /// <summary>
        /// Determines whether the index value should be generate by IndexDB.
        /// Only use if you are defining a primary <see cref="IndexedDBIndex.KeyPath"/> such as "id"
        /// <para>
        /// Will throw an error if set to true and the <see cref="IndexedDBIndex.KeyPath"/> is an array with more than one item.
        /// </para>
        /// <para>
        /// Has no effect when specified in <see cref="IndexedDBStoreSchema.Indexes"/>.
        /// </para>
        /// </summary>
        public bool Auto { get; set; }
    }
}
