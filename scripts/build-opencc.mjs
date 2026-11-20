// Builds public/opencc-chars.json from OpenCC's single-character dictionaries (Apache-2.0).
//   TSCharacters.txt: 繁體 -> 簡體 (t2s)      STCharacters.txt: 簡體 -> 繁體 (s2t)
// Identity mappings are dropped; one-to-many mappings keep every variant, in OpenCC's order.
import { readFileSync, writeFileSync } from "node:fs";

function parse(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [k, v] = line.split("\t");
    if (!k || !v) continue;
    const vals = v.trim().split(/\s+/).filter((x) => x !== k);
    if (vals.length) out[k] = vals;
  }
  return out;
}

const t2s = parse("data-src/TSCharacters.txt");
const s2t = parse("data-src/STCharacters.txt");
writeFileSync("public/opencc-chars.json", JSON.stringify({ t2s, s2t }));
console.log("t2s", Object.keys(t2s).length, "s2t", Object.keys(s2t).length);
