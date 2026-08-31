/**
 * Salin runtime SQLite WASM ke public/sqlite/.
 *
 * Paketnya tidak bisa di-bundle Turbopack: di dalamnya ada
 * `new Worker(new URL(proxyUri, import.meta.url))` dengan URL dinamis (dipakai
 * VFS `opfs` yang tidak kita pakai), dan bundler menolaknya saat build.
 * Karena itu berkasnya disajikan apa adanya dari public/ lalu di-import worker
 * saat runtime.
 *
 * Dijalankan otomatis lewat `postinstall` dan `prebuild` agar tidak pernah
 * tertinggal versi dari node_modules.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@sqlite.org", "sqlite-wasm", "dist");
const to = join(root, "public", "sqlite");

mkdirSync(to, { recursive: true });

const files = [
  ["index.mjs", "sqlite3.mjs"],
  ["sqlite3.wasm", "sqlite3.wasm"],
];

for (const [source, target] of files) {
  copyFileSync(join(from, source), join(to, target));
  console.log(`sqlite: ${source} -> public/sqlite/${target}`);
}
