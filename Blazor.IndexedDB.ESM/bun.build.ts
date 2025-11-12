const env = process.env["IDB_TARGET"] || "Debug";
console.log(`Building for environment: ${env}`);
Bun.build({
    entrypoints: ["./client/app.ts"],
    naming:{
        entry: "client.[ext]",
    },
    outdir: "./wwwroot",
    splitting: false,
    target: "browser",
    sourcemap: true,
    minify: env === "Release",
    format: "esm",
    define: {
        DEBUG: env === "Debug" ? "true" : "false"
    }
})


//bun build ./client/app.ts --outfile=./wwwroot/client.js --target browser

//npx bun build ./client/app.ts --outfile=./wwwroot/client.js --target browser