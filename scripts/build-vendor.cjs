const { buildSync } = require('esbuild');
const { copyFileSync } = require('node:fs');
buildSync({
    stdin: { contents: 'export { casual } from "chrono-node/en";', resolveDir: process.cwd() },
    bundle: true, minify: true, format: 'iife', globalName: 'chrono',
    outfile: 'vendor/chrono.min.js',
    banner: { js: '/* Chrono 2.10.1 | MIT license: CHRONO-LICENSE */' }
});
copyFileSync('node_modules/chrono-node/LICENSE.txt', 'vendor/CHRONO-LICENSE');
