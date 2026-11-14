import { expect, test, type Browser, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import mongoose from "mongoose";

/**
 * Phase 4 admin flows. Needs the seeded admin (+9779849361011), the demo data,
 * and a server running with SMS_PROVIDER=outbox. Test setup touches the DB
 * directly only to put listings into PENDING_REVIEW.
 */
config({ path: ".env.local" });
const OUTBOX = path.join(process.cwd(), ".outbox", "sms");

async function codeFor(phone: string, since: number) {
  for (let i = 0; i < 40; i++) {
    for (const f of (await fs.readdir(OUTBOX).catch(() => [])).sort().reverse()) {
      try {
        const m = JSON.parse(await fs.readFile(path.join(OUTBOX, f), "utf8"));
        if (m.to === phone && new Date(m.at).getTime() >= since) return String(m.text).match(/\b(\d{6})\b/)![1];
      } catch {
        /* being written */
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no OTP");
}

async function login(page: Page, local: string, next: string) {
  const since = Date.now();
  await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Mobile number" }).fill(local);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill(await codeFor(`+977${local}`, since));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

test.describe.configure({ mode: "serial" });

test.describe("admin", () => {
  test.skip(({ isMobile }) => isMobile, "admin flows run on desktop");
  let page: Page;
  let pendingA: string;
  let pendingB: string;
  let originals: Record<string, unknown>[] = [];
  const KEEP = ["status", "tier", "tierRank", "currentPlan", "expiresAt", "featuredUntil", "validationWarnings", "rejectionReason", "reviewedAt", "reviewedBy", "submittedAt"];

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB || undefined });
    const col = mongoose.connection.collection("properties");
    const docs = await col.find({ isDemo: true, status: "ACTIVE" }).sort({ code: -1 }).limit(2).toArray();
    expect(docs).toHaveLength(2);
    [pendingA, pendingB] = docs.map((d) => String(d._id));
    originals = docs.map((d) => ({ _id: d._id, ...Object.fromEntries(KEEP.map((k) => [k, d[k] ?? null])) }));
    await col.updateMany({ _id: { $in: docs.map((d) => d._id) } }, { $set: { status: "PENDING_REVIEW", validationWarnings: ["NO_PHOTOS"], submittedAt: new Date() } });
    // Reuse a saved admin session (OTP requests are rate-limited per phone).
    const state = path.join(process.cwd(), ".playwright", "admin-state.json"); // test-results is wiped per run
    const saved = await fs.stat(state).then(() => true, () => false);
    const ctx = await browser.newContext(saved ? { storageState: state } : {});
    page = await ctx.newPage();
    const res = saved ? await page.goto("/en/admin") : null;
    if (!res || res.status() !== 200 || !page.url().endsWith("/en/admin")) {
      await login(page, "9849361011", "/en/admin");
      await fs.mkdir(path.dirname(state), { recursive: true });
      await ctx.storageState({ path: state });
    }
  });

  test.afterAll(async () => {
    // Restore both demo listings exactly as they were (keeps the suite repeatable).
    for (const o of originals) {
      const { _id, ...rest } = o;
      await mongoose.connection.collection("properties").updateOne({ _id: _id as mongoose.Types.ObjectId }, { $set: rest });
    }
    await mongoose.connection.collection("subscriptions").deleteMany({ property: { $in: originals.map((o) => o._id as mongoose.Types.ObjectId) }, startsAt: { $gte: new Date(Date.now() - 3600_000) } });
    await mongoose.disconnect();
    await page.close();
  });

  test("non-staff users get a 404", async ({ browser }) => {
    const p = await browser.newPage();
    await login(p, `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, "/en/dashboard");
    const res = await p.goto("/en/admin");
    expect(res?.status()).toBe(404);
    await p.close();
  });

  test("dashboard and queue", async () => {
    await page.goto("/en/admin");
    await expect(page.locator("h1")).toHaveText("Dashboard");
    await expect(page.getByRole("figure")).toContainText("New listings per day");
    await page.getByRole("link", { name: /Moderation queue/ }).click();
    await expect(page.getByRole("table", { name: "Listings awaiting review" })).toContainText("No photos");
  });

  test("approve publishes on the chosen plan; reject sends it back", async () => {
    await page.goto(`/en/admin/moderation/${pendingA}`);
    const premium = await page.locator("#plan option", { hasText: /^Premium/ }).getAttribute("value");
    await page.getByLabel("Plan").selectOption(premium!);
    await page.getByRole("button", { name: "Approve and publish" }).click();
    await page.waitForURL("**/en/admin/moderation");
    const a = await mongoose.connection.collection("properties").findOne({ _id: new mongoose.Types.ObjectId(pendingA) });
    expect(a?.status).toBe("ACTIVE");
    expect(a?.tier).toBe("PREMIUM");
    expect(a?.expiresAt).toBeTruthy();
    expect((await page.request.get(`/en/property/${a!.slug}`)).status()).toBe(200);

    await page.goto(`/en/admin/moderation/${pendingB}`);
    await page.getByRole("button", { name: /^Photos are missing/ }).click();
    await page.getByRole("button", { name: "Send back" }).click();
    await page.waitForURL("**/en/admin/moderation");
    const b = await mongoose.connection.collection("properties").findOne({ _id: new mongoose.Types.ObjectId(pendingB) });
    expect(b?.status).toBe("REJECTED");
    expect(b?.rejectionReason).toContain("Photos are missing");
  });

  test("site settings drive the public footer", async () => {
    await page.goto("/en/admin/settings");
    const field = page.getByLabel("Office hours (English)");
    const original = await field.inputValue();
    await field.fill("Sun–Fri, 9:30 AM – 5:30 PM");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    await page.goto("/en/properties");
    await expect(page.locator("footer")).toContainText("Sun–Fri, 9:30 AM – 5:30 PM");
    await page.goto("/en/admin/settings");
    await page.getByLabel("Office hours (English)").fill(original);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
  });

  test("FAQ create and delete", async () => {
    await page.goto("/en/admin/content/faqs/new");
    await page.locator("#f-question-en").fill("Do you charge buyers a fee?");
    await page.locator("#f-answer-en").fill("No. Searching and contacting owners is free for buyers.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/en\/admin\/content\/faqs\/[a-f0-9]{24}$/);
    await page.goto("/en/admin/content/faqs");
    await expect(page.getByRole("link", { name: "Do you charge buyers a fee?" })).toBeVisible();
    await page.getByRole("link", { name: "Do you charge buyers a fee?" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/en/admin/content/faqs");
    await expect(page.getByRole("link", { name: "Do you charge buyers a fee?" })).toHaveCount(0);
  });

  test("CSV import validates rows and publishes the good ones", async () => {
    const tpl = await (await page.request.get("/api/admin/import")).text();
    const [head, example] = tpl.replace(/^﻿/, "").split(/\r?\n/);
    const bad = example.replace('"Bhaktapur"', '"Atlantis"');
    const file = path.join(process.cwd(), "test-results", "import.csv");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, [head, example, bad].join("\n"));

    await page.goto("/en/admin/import");
    await page.getByLabel(/CSV or Excel/).setInputFiles(file);
    await page.getByRole("button", { name: "Check file" }).click();
    await expect(page.getByText(/Row 3:.*district: “Atlantis” not found/)).toBeVisible();
    await page.getByRole("button", { name: "Import 1 listings" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("Imported 1 listings");
    await expect(status).toContainText("live");
    const code = (await status.locator(".font-mono").first().textContent())!.trim();
    const doc = await mongoose.connection.collection("properties").findOne({ code });
    expect(doc?.status).toBe("ACTIVE");
    expect(doc?.title?.en).toBe("8 Aana Land for Sale in Suryabinayak, Bhaktapur");
    await mongoose.connection.collection("properties").updateOne({ code }, { $set: { status: "DELETED" } });
  });

  test("every admin page renders", async () => {
    const pages: [string, string][] = [
      ["/en/admin/reports", "Reports"],
      ["/en/admin/listings", "Listings"],
      ["/en/admin/listings?status=ACTIVE&q=bhaktapur", "Listings"],
      ["/en/admin/leads", "Leads"],
      ["/en/admin/verifications", "Verifications"],
      ["/en/admin/users", "Users"],
      ["/en/admin/import", "Bulk import"],
      ["/en/admin/content/blog", "Blog posts"],
      ["/en/admin/content/blog/new", "New post"],
      ["/en/admin/content/testimonials", "Testimonials"],
      ["/en/admin/content/banners/new", "New banner"],
      ["/en/admin/content/amenities", "Amenities"],
      ["/en/admin/content/districts", "Districts"],
      ["/en/admin/content/municipalities", "Local levels"],
      ["/en/admin/content/plans", "Plans"],
      ["/en/admin/settings", "Site settings"],
    ];
    for (const [url, h1] of pages) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.locator("h1"), url).toHaveText(h1);
    }
    // Edit a plan and a district through the generic form.
    await page.goto("/en/admin/content/plans");
    await page.getByRole("link", { name: "Normal" }).first().click();
    await expect(page.locator("#f-priceNpr")).toHaveValue("6000");
    await page.goto("/en/admin/content/districts?q=siraha");
    await page.getByRole("link", { name: "Siraha" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("leads CSV export and audit log", async () => {
    const res = await page.request.get("/api/admin/leads");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("created_at,listing_code,source");
    await page.goto("/en/admin/audit");
    await expect(page.getByRole("table", { name: "Audit log" })).toContainText("property.approve");
    await expect(page.getByRole("table", { name: "Audit log" })).toContainText("settings.update");
    await expect(page.getByRole("table", { name: "Audit log" })).toContainText("import.commit");
  });
});
