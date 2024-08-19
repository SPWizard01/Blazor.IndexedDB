using System.Collections.Generic;

namespace Blazor.IndexedDB.Models
{
    /// <summary>
    /// Defines a store to add to database
    /// </summary>
    public class IndexedDBStoreSchema
    {
        /// <summary>
        /// The name for the store
        /// </summary>
        public required string Name { get; set; }

        /// <summary>
        /// Defines the primary key to use. If not defined automatically creates a primary that is 
        /// set to true for auto increment, and has the name and path of "id"
        /// </summary>
        public IndexedDBIndex PrimaryKey { get; set; } = new IndexedDBIndex { Name = "id", KeyPath = ["id"], Auto = true };

        /// <summary>
        /// Provides a set of additional indexes if required.
        /// </summary>
        public List<IndexedDBIndex> Indexes { get; set; } = [];
    }
}
