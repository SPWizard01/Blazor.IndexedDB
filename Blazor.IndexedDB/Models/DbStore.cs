using System.Collections.Generic;

namespace Blazor.IndexedDB.Models
{
    /// <summary>
    /// Used to define the database and associated stores
    /// </summary>
    public class DbStore
    {

        /// <summary>
        /// Name of the database to create
        /// </summary>
        public string DbName { get; set; }
        /// <summary>
        /// the version of the database. Increment the value when adding a new store.
        /// </summary>
        public int Version { get; set; }
        /// <summary>
        /// A list of store schemas used to create the database stores.
        /// </summary>
        public List<StoreSchema> Stores { get; } = [];

    }
}
