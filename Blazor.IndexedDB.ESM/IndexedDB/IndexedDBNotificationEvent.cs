namespace Blazor.IndexedDB.ESM
{

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