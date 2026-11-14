// Merge a JSON fragment into messages/<locale>.json (deep, fragment wins) and check en/ne key parity.
// Usage: node scripts/merge-messages.mjs en path/to/en.json ne path/to/ne.json
import fs from "node:fs";
const args = process.argv.slice(2);
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v;
  return a;
};
for (let i = 0; i < args.length; i += 2) {
  const p = `messages/${args[i]}.json`;
  fs.writeFileSync(p, JSON.stringify(merge(JSON.parse(fs.readFileSync(p, "utf8")), JSON.parse(fs.readFileSync(args[i + 1], "utf8"))), null, 2) + "\n");
}
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, p + k + ".") : [p + k]));
const en = new Set(flat(JSON.parse(fs.readFileSync("messages/en.json", "utf8"))));
const ne = new Set(flat(JSON.parse(fs.readFileSync("messages/ne.json", "utf8"))));
const onlyEn = [...en].filter((k) => !ne.has(k));
const onlyNe = [...ne].filter((k) => !en.has(k));
console.log(`en ${en.size} keys, ne ${ne.size} keys`, onlyEn.length || onlyNe.length ? { onlyEn, onlyNe } : "— in sync");
if (onlyEn.length || onlyNe.length) process.exitCode = 1;
