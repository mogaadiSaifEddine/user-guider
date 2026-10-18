// Bundles the embed script into public/sdk.js, and the builder-only screenshot
// helper into public/sdk-capture.js. `node sdk/build.mjs --watch` rebuilds on change.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
};
const builds = [
  { ...common, entryPoints: ["sdk/index.ts"], outfile: "public/sdk.js" },
  { ...common, entryPoints: ["sdk/capture.ts"], outfile: "public/sdk-capture.js" },
];

if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
  console.log("[sdk] watching");
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  console.log("[sdk] built public/sdk.js and public/sdk-capture.js");
}
