﻿using System.Collections.Generic;

namespace Blazor.IndexedDB.ESM.Models
{
    public sealed class IndexedDBManagerConfig
    {
        public List<IndexedDBDatabase> Databases { get; set; } = [];
        public required IndexedDBNotificationConfig Config { get; set; }

    }
}
