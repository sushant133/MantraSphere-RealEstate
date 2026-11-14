/**
 * Seed a database with reference data and (optionally) 30 demo listings.
 *
 *   npm run seed                 # locations, plans, amenities, settings, FAQ, demo listings
 *   npm run seed -- --no-demo    # reference data only (use this in production)
 *   npm run seed -- --reset-demo # delete demo listings and recreate them
 *   npm run seed -- --purge-demo # delete demo listings and stop
 *   npm run seed -- --refresh-demo-images # give existing demo listings the current photo set
 *   npm run seed -- --fresh      # DEV ONLY: drop the whole database first
 *
 * Idempotent: reference data is upserted by natural keys; demo listings are
 * skipped if they already exist.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import path from "node:path";
import { promises as fs } from "node:fs";
import mongoose from "mongoose";
import { connectDB, disconnectDB, trusted } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { nextPropertyCode } from "@/lib/counters";
import { DEFAULT_SETTINGS } from "@/lib/site-defaults";
import {
  Amenity, BlogPost, District, Faq, Municipality, Plan, Property, Province, SiteSetting, StaticPage, User,
} from "@/models";
import { BLOG_COVERS, BLOG_POSTS, EXTRA_FAQS, LEGAL_PAGES } from "./seed/content";
import { AMENITIES, FAQS, PLANS, TERAI_DISTRICTS } from "./seed/reference-data";
import { PLACES, SPECS, buildDemoListing } from "./seed/demo-listings";
import { fetchDemoPhotos } from "./seed/fetch-demo-photos";
import { buildDemoImagePool, loadDemoPhotoPool, photosForListing, typeOrdinals } from "./seed/demo-images";

type LocationData = {
  provinces: { id: number; en: string; ne: string; hq: string }[];
  districts: { id: number; provinceId: number; en: string; ne: string; hq: string }[];
  municipalities: {
    id: number;
    districtId: number;
    en: string;
    ne: string;
    category: "METROPOLITAN" | "SUB_METROPOLITAN" | "MUNICIPALITY" | "RURAL_MUNICIPALITY";
    wards: number;
  }[];
};

const args = new Set(process.argv.slice(2));
const log = (...a: unknown[]) => console.log("•", ...a);

async function seedLocations() {
  const data = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "nepal-locations.json"), "utf8"),
  ) as LocationData;

  await Province.bulkWrite(
    data.provinces.map((p) => ({
      updateOne: {
        filter: { refId: p.id },
        update: { $set: { refId: p.id, slug: slugify(p.en), name: { en: p.en, ne: p.ne }, headquarter: p.hq } },
        upsert: true,
      },
    })),
  );
  const provinces = new Map((await Province.find().lean()).map((p) => [p.refId, p._id]));

  await District.bulkWrite(
    data.districts.map((d) => ({
      updateOne: {
        filter: { refId: d.id },
        update: {
          $set: {
            refId: d.id,
            slug: slugify(d.en),
            name: { en: d.en, ne: d.ne },
            province: provinces.get(d.provinceId),
            headquarter: d.hq,
            region: TERAI_DISTRICTS.has(d.en) ? "TERAI" : "HILL",
          },
        },
        upsert: true,
      },
    })),
  );
  const districts = await District.find().lean();
  const districtById = new Map(districts.map((d) => [d.refId, d]));

  // Municipality slugs are unique: plain name, or name + district when the name repeats.
  const nameCount = new Map<string, number>();
  for (const m of data.municipalities) nameCount.set(slugify(m.en), (nameCount.get(slugify(m.en)) ?? 0) + 1);

  await Municipality.bulkWrite(
    data.municipalities.map((m) => {
      const d = districtById.get(m.districtId)!;
      const base = slugify(m.en);
      const slug = (nameCount.get(base) ?? 0) > 1 ? `${base}-${d.slug}` : base;
      return {
        updateOne: {
          filter: { refId: m.id },
          update: {
            $set: { refId: m.id, slug, name: { en: m.en, ne: m.ne }, district: d._id, category: m.category, wards: m.wards },
          },
          upsert: true,
        },
      };
    }),
  );

  // Rough district centres for the demo localities (used by the map's initial view).
  for (const p of PLACES) {
    await District.updateOne({ "name.en": p.district, center: trusted({ $exists: false }) }, { $set: { center: [p.lng, p.lat] } });
  }

  log(
    `locations: ${await Province.countDocuments()} provinces, ${await District.countDocuments()} districts, ${await Municipality.countDocuments()} local levels`,
  );
}

async function seedPlans() {
  await Plan.bulkWrite(
    PLANS.map((p) => ({
      updateOne: { filter: { slug: p.slug }, update: {
        $setOnInsert: { ...p, features: { en: [...p.features.en], ne: [...p.features.ne] }, active: true },
      }, upsert: true },
    })),
  );
  log(`plans: ${await Plan.countDocuments()}`);
}

async function seedAmenities() {
  await Amenity.bulkWrite(
    AMENITIES.map((a, i) => ({
      updateOne: {
        filter: { slug: a.slug },
        update: { $setOnInsert: { slug: a.slug, name: { en: a.en, ne: a.ne }, icon: a.icon, appliesTo: a.appliesTo ?? [], order: i } },
        upsert: true,
      },
    })),
  );
  log(`amenities: ${await Amenity.countDocuments()}`);
}

async function seedSettingsAndFaq() {
  await SiteSetting.updateOne({ _id: "site" }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true });
  if ((await Faq.countDocuments()) === 0) {
    await Faq.insertMany(FAQS.map((f, i) => ({ ...f, order: i, active: true })));
  }
  // General FAQs added later: inserted once, never overwrite admin edits.
  for (const [i, f] of EXTRA_FAQS.entries()) {
    await Faq.updateOne({ "question.en": f.question.en }, { $setOnInsert: { ...f, order: 100 + i, active: true } }, { upsert: true });
  }
  log(`settings: ok, faq: ${await Faq.countDocuments()}`);
}

/** Give seeded posts a cover photo, only where none is set (admin-chosen covers are kept). */
async function seedBlogCovers() {
  const src = path.join(process.cwd(), "public", "uploads", "demo-photos");
  const dst = path.join(process.cwd(), "public", "uploads", "cms");
  await fs.mkdir(dst, { recursive: true });
  for (const [slug, c] of Object.entries(BLOG_COVERS)) {
    const post = await BlogPost.findOne({ slug }).select("coverImage").lean();
    if (!post || post.coverImage?.url) continue;
    const base = `blog-${slug.slice(0, 40)}`;
    try {
      for (const w of [400, 800, 1600]) await fs.copyFile(path.join(src, `${c.photo}-${w}.webp`), path.join(dst, `${base}-${w}.webp`));
    } catch {
      continue; // demo photos not downloaded (offline): leave the post without a cover
    }
    await BlogPost.updateOne({ slug }, { $set: { coverImage: { url: `/uploads/cms/${base}-1600.webp`, alt: c.alt, width: 1600, height: 1200 } } });
  }
}

async function seedContent() {
  for (const page of LEGAL_PAGES) {
    await StaticPage.updateOne({ slug: page.slug }, { $setOnInsert: page }, { upsert: true });
  }
  for (const post of BLOG_POSTS()) {
    await BlogPost.updateOne({ slug: post.slug }, { $setOnInsert: { ...post, status: "PUBLISHED" } }, { upsert: true });
  }
  await seedBlogCovers();
  log(`pages: ${await StaticPage.countDocuments()}, blog posts: ${await BlogPost.countDocuments()}`);
}

async function seedCompanyUser() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? DEFAULT_SETTINGS.email).toLowerCase();
  const phone = process.env.SEED_ADMIN_PHONE ?? DEFAULT_SETTINGS.phones[0];
  const user = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, phone, name: "MantraSphere Admin", role: "ADMIN", verified: true } },
    { upsert: true, new: true },
  );
  log(`admin user: ${user.email} (${user.role}) — set a password/OTP login in Phase 3`);
  return user;
}

async function purgeDemo() {
  const res = await Property.deleteMany({ isDemo: true });
  log(`removed ${res.deletedCount} demo listings`);
}

async function demoPhotos() {
  const ready = await loadDemoPhotoPool(process.cwd());
  if (ready) return ready;
  log("downloading demo photos (one-off, ~85 CC0 images)…");
  await fetchDemoPhotos(false, () => {}).catch((e) => log(`photo download failed: ${(e as Error).message}`));
  return loadDemoPhotoPool(process.cwd());
}

/** Swap the photos on existing demo listings in place (codes, slugs and stats stay the same). */
async function refreshDemoImages() {
  const photos = await demoPhotos();
  if (!photos) throw new Error("Demo photos missing: run npx tsx scripts/seed/fetch-demo-photos.ts first");
  const demos = await Property.find({ isDemo: true }).sort({ code: 1 }).select("type title").lean();
  const ordinal = typeOrdinals();
  for (const d of demos) {
    const title = d.title?.en ?? "";
    const images = photosForListing(photos, d.type, ordinal(d.type)).map((img, k) => ({
      url: img.url,
      sizes: img.sizes,
      width: img.width,
      height: img.height,
      blurDataURL: img.blurDataURL,
      alt: (img.room ? `${title} – ${img.room}` : title).slice(0, 160),
      order: k,
      isCover: k === 0,
    }));
    await Property.updateOne({ _id: d._id }, { $set: { images } });
  }
  log(`demo photos refreshed on ${demos.length} listings`);
}

async function seedDemo(ownerId: mongoose.Types.ObjectId) {
  if (args.has("--refresh-demo-images")) await refreshDemoImages();
  if (args.has("--reset-demo")) await purgeDemo();
  const existing = await Property.countDocuments({ isDemo: true });
  if (existing > 0) {
    log(`demo listings: ${existing} already present (use --reset-demo to recreate)`);
    return;
  }

  // Real CC0 photos (downloaded once on first seed), else drawn illustrations when offline.
  const photos = await demoPhotos();
  if (!photos) log("demo photos unavailable (offline?) — using illustrations; run npm run seed:photos later");
  const pool = photos ? null : await buildDemoImagePool(process.cwd());
  const plans = new Map((await Plan.find().lean()).map((p) => [p.tier, p]));
  const now = new Date();
  const ordinal = typeOrdinals();

  for (const [i, spec] of SPECS.entries()) {
    const place = PLACES[spec.p];
    const district = await District.findOne({ "name.en": place.district }).lean();
    if (!district) throw new Error(`District not found: ${place.district}`);
    const municipality = await Municipality.findOne({ district: district._id, "name.en": place.muni }).lean();
    if (!municipality) throw new Error(`Municipality not found: ${place.muni} (${place.district})`);
    const province = await Province.findById(district.province).lean();
    if (!province) throw new Error(`Province not found for ${place.district}`);

    const code = await nextPropertyCode();
    const scene = { HOUSE: "house", BUNGALOW: "house", LAND: "land", FLAT: "flat" }[spec.type as string] ?? "commercial";
    const images = photos
      ? photosForListing(photos, spec.type, ordinal(spec.type))
      : [0, 1, 2, 3].map((k) => pool![scene as keyof NonNullable<typeof pool>][(i + k) % 4]);

    const doc = buildDemoListing({
      index: i,
      spec,
      code,
      loc: { province, district, municipality },
      ownerId,
      phones: DEFAULT_SETTINGS.phones,
      images,
      now,
      planDurationDays: plans.get(spec.tier)?.durationDays ?? null,
    });
    const { scene: _scene, ...rest } = doc;
    void _scene;
    await new Property({ ...rest, currentPlan: plans.get(spec.tier)?._id }).save({ timestamps: false });
  }

  // Denormalised count for "Browse by district".
  const counts = await Property.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$district", n: { $sum: 1 } } },
  ]);
  await District.updateMany({}, { $set: { listingCount: 0 } });
  await District.bulkWrite(counts.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { listingCount: c.n } } } })));

  log(`demo listings: ${await Property.countDocuments({ isDemo: true })}`);
}

async function main() {
  const conn = await connectDB();
  log(`connected to ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

  if (args.has("--fresh")) {
    if (process.env.NODE_ENV === "production") throw new Error("--fresh is disabled in production");
    await conn.connection.dropDatabase();
    log("dropped database (fresh seed)");
  }

  if (args.has("--purge-demo")) {
    await purgeDemo();
    return;
  }

  // Build indexes up front so the unique constraints apply to the seed itself.
  for (const m of Object.values(mongoose.models)) await m.syncIndexes();

  await seedLocations();
  await seedPlans();
  await seedAmenities();
  await seedSettingsAndFaq();
  if (!args.has("--no-demo")) await demoPhotos(); // blog covers reuse the demo photos
  await seedContent();
  const admin = await seedCompanyUser();
  if (!args.has("--no-demo")) await seedDemo(admin._id);
}

main()
  .then(() => log("done"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
