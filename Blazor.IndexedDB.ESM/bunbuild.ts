const env = process.argv[2];
Bun.build({
    entrypoints: ["./client/app.ts"],
    naming:{
        entry: "client",
    },
    outdir: "./wwwroot",
    splitting: false,
    target: "browser",
    minify: env === "Release",
    format: "esm"
})


//bun build ./client/app.ts --outfile=./wwwroot/client.js --target browser

//npx bun build ./client/app.ts --outfile=./wwwroot/client.js --target browser