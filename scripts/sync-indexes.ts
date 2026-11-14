/**
 * Build/sync all Mongoose indexes, then verify with explain() that the key
 * queries use an index (no COLLSCAN). Run after deploys: `npm run db:sync-indexes`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import mongoose from "mongoose";
import { connectDB, disconnectDB, textSearch, trusted } from "@/lib/db";
import "@/models";
import { Property } from "@/models";

type Plan = { stage?: string; inputStage?: Plan; inputStages?: Plan[]; indexName?: string; queryPlan?: Plan };

function stages(p: Plan | undefined, out: string[] = []): string[] {
  if (!p) return out;
  if (p.queryPlan) return stages(p.queryPlan, out);
  if (p.stage) out.push(p.indexName ? `${p.stage}(${p.indexName})` : p.stage);
  stages(p.inputStage, out);
  p.inputStages?.forEach((s) => stages(s, out));
  return out;
}

async function main() {
  await connectDB();
  for (const [name, model] of Object.entries(mongoose.models)) {
    const dropped = await model.syncIndexes();
    const idx = await model.listIndexes();
    console.log(`• ${name}: ${idx.length} indexes${dropped.length ? ` (dropped: ${dropped.join(", ")})` : ""}`);
  }

  const anyDistrict = (await Property.findOne().select("district").lean())?.district;
  const checks: [string, () => Promise<unknown>][] = [
    [
      "filter: status+purpose+type+district+price",
      () =>
        Property.find({ status: "ACTIVE", purpose: "SALE", type: "LAND", district: anyDistrict, priceTotalNpr: trusted({ $gte: 1 }) })
          .explain("queryPlanner"),
    ],
    ["home sections: status + tierRank/createdAt", () => Property.find({ status: "ACTIVE" }).sort({ tierRank: -1, createdAt: -1 }).limit(8).explain("queryPlanner")],
    ["expiry cron: status + expiresAt", () => Property.find({ status: "ACTIVE", expiresAt: trusted({ $lte: new Date() }) }).explain("queryPlanner")],
    ["text search", () => Property.collection.find(textSearch("bhaktpur")).explain("queryPlanner")],
    [
      "map bounds: 2dsphere",
      () =>
        Property.find({
          location: trusted({
            $geoWithin: {
              $geometry: { type: "Polygon", coordinates: [[[85.2, 27.6], [85.5, 27.6], [85.5, 27.8], [85.2, 27.8], [85.2, 27.6]]] },
            },
          }),
        }).explain("queryPlanner"),
    ],
  ];

  let bad = 0;
  for (const [label, run] of checks) {
    const res = (await run()) as { queryPlanner?: { winningPlan?: Plan } }[] | { queryPlanner?: { winningPlan?: Plan } };
    const qp = Array.isArray(res) ? res[0] : res;
    const s = stages(qp.queryPlanner?.winningPlan);
    const ok = !s.includes("COLLSCAN");
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${label}: ${s.join(" → ")}`);
  }
  if (bad) {
    console.error(`${bad} query shape(s) fell back to COLLSCAN`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
