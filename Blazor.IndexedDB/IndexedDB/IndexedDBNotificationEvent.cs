using System;

namespace Blazor.IndexedDB
{

    public class IndexedDBNotificationEvent : EventArgs
    {
        public IndexDBActionOutcome Outcome { get; set; }
        public string Message { get; set; }
    }

    public enum IndexDBActionOutcome
    {
        Success,
        Failure,
        DatabaseCreated,
        DatabaseDeleted,
        DatabaseOpened,
        DatabaseOpenFailure,
        DatabaseClosed,
        DatabaseUpgradeBlocking,
        DatabaseUpgradeBlocked,
        SchemaVerificationFailure,
        TableCreated,
        TableRemoved,
        TableUpdated,
        TableDeleted,

        IndexCreated,

        RecordAdded,
        RecordAddFailure,
        RecordUpdated,
        RecordUpdateFailure,
        RecordDeleted,
        RecordDeleteFailure,
    }
}