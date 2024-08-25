import { type DotNet } from "@microsoft/dotnet-js-interop";
declare global {
    const DEBUG: boolean;
    interface Window {
        DotNet: typeof DotNet;
    }
}
//declare const DEBUG: boolean;
export { };