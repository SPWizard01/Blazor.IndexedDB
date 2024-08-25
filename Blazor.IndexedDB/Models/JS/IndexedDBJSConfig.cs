﻿
using Microsoft.JSInterop;

namespace Blazor.IndexedDB.Models.JS
{
    public sealed class IndexedDBJSConfig : IndexedDBNotificationConfig
    {
        public required DotNetObjectReference<IndexedDBManager> DotNetReference { get; set; }
    }
}
