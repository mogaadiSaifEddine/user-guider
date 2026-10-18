// Bundles the embed script into public/sdk.js. `node sdk/build.mjs --watch` rebuilds on change.
import * as esbuild from "esbuild";

const options = {
  entryPoints: ["sdk/index.ts"],
  outfile: "public/sdk.js",
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: !process.argv.includes("--watch"),
  sourcemap: process.argv.includes("--watch") ? "inline" : false,
  legalComments: "none",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("[sdk] watching");
} else {
  await esbuild.build(options);
  console.log("[sdk] built public/sdk.js");
}
