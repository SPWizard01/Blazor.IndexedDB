// export type UpgradeOutcome = TableCreatedOutcome | IndexCreatedOutcome;
export interface UpgradeOutcome {
    type: "TableCreated" | "IndexCreated";
    message: string;
}

interface TableCreatedOutcome {
    type: "TableCreated";
    storeName: string;
    oldVersion: number;
    newVersion: number;
}

interface IndexCreatedOutcome {
    type: "IndexCreated";
    storeName: string;
    indexName: string;
    oldVersion: number;
    newVersion: number;
}