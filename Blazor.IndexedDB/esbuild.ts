import esbuild from "esbuild";

const env = process.argv[2]
async function build() {
    await esbuild.build({
        entryPoints: {
            app: "./client/app.ts"
        },
        outfile: "./wwwroot/client.js",
        bundle: true,
        minify: env === "Release",
        platform: "browser",
        color: true,        
        logLevel: "info",
        format: "esm"
    })
}

build();