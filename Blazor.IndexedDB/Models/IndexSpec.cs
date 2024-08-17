namespace Blazor.IndexedDB.Models
{
    /// <summary>
    /// Defines an Index for a given object store.
    /// </summary>
    public class IndexSpec
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
        /// If true, the index will be created as a string instead of an array when KeyPath has only one value.
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
        /// determines whether the index value should be generate by IndexDB.
        /// Only use if you are defining a primary key such as "id"
        /// </summary>
        public bool Auto { get; set; }
    }
}
