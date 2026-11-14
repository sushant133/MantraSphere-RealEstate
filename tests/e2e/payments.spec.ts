import { expect, test, type Browser, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import mongoose from "mongoose";

/**
 * Phase 5: checkout, bank transfer verification, renewal, receipts, cron.
 * Server must run with PAYMENT_MODE=mock, SMS_PROVIDER=outbox and CRON_SECRET.
 */
config({ path: ".env.local" });
const SMS = path.join(process.cwd(), ".outbox", "sms");
const oid = (s: string) => new mongoose.Types.ObjectId(s);

async function waitSms(to: string, re: RegExp, since: number) {
  for (let i = 0; i < 40; i++) {
    for (const f of (await fs.readdir(SMS).catch(() => [])).sort().reverse()) {
      try {
        const m = JSON.parse(await fs.readFile(path.join(SMS, f), "utf8"));
        if (m.to === to && re.test(m.text) && new Date(m.at).getTime() >= since) return m.text as string;
      } catch {
        /* partial write */
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no SMS ${re} to ${to}`);
}

async function login(page: Page, local: string, next: string) {
  const since = Date.now();
  await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Mobile number" }).fill(local);
  await page.getByRole("button", { name: "Send code" }).click();
  const text = await waitSms(`+977${local}`, /login code/, since);
  await page.getByLabel("6-digit code").fill(text.match(/\b(\d{6})\b/)![1]);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

test.describe.configure({ mode: "serial" });

test.describe("payments", () => {
  let owner: Page;
  let admin: Page;
  let phone: string;
  let userId: string;
  const created: mongoose.Types.ObjectId[] = [];
  const props = () => mongoose.connection.collection("properties");
  const payments = () => mongoose.connection.collection("payments");

  /** A complete DRAFT owned by the test user, cloned from a demo listing. */
  async function cloneDraft(status = "DRAFT", extra: Record<string, unknown> = {}) {
    const src = await props().findOne({ isDemo: true, type: "LAND", status: "ACTIVE" });
    const counter = await mongoose.connection.collection("counters").findOneAndUpdate({ _id: "property" as never }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true });
    const code = `MSR-${String(counter!.seq).padStart(6, "0")}`;
    const plan = await mongoose.connection.collection("plans").findOne({ slug: "normal" });
    const { _id, ...rest } = src!;
    void _id;
    const doc = { ...rest, code, slug: `draft-${code.toLowerCase()}`, owner: oid(userId), status, isDemo: false, requestedPlan: plan!._id, contactPhone: `+977${phone}`, views: 0, leadsCount: 0, ...extra };
    const r = await props().insertOne(doc);
    created.push(r.insertedId);
    return { id: String(r.insertedId), code };
  }

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB || undefined });
    phone = `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    owner = await browser.newPage();
    await login(owner, phone, "/en/dashboard");
    userId = String((await mongoose.connection.collection("users").findOne({ phone: `+977${phone}` }))!._id);
    const state = path.join(process.cwd(), ".playwright", "admin-state.json");
    const ctx = await browser.newContext(await fs.stat(state).then(() => ({ storageState: state }), () => ({})));
    admin = await ctx.newPage();
    const res = await admin.goto("/en/admin/payments");
    if (res?.status() !== 200 || !admin.url().endsWith("/en/admin/payments")) {
      await login(admin, "9849361011", "/en/admin");
      await fs.mkdir(path.dirname(state), { recursive: true });
      await ctx.storageState({ path: state });
    }
  });

  test.afterAll(async () => {
    await props().deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  });

  test("failed attempt can be retried, then the paid listing goes to review", async () => {
    test.setTimeout(150_000);
    const { id } = await cloneDraft();
    await owner.goto(`/en/dashboard/listings/${id}/edit?step=8`);
    await owner.getByRole("button", { name: "Continue to payment" }).click();
    await expect(owner).toHaveURL(/\/checkout\/[a-f0-9]{24}$/);
    await owner.getByRole("button", { name: "Pay with test gateway" }).click();
    await owner.getByRole("link", { name: "Simulate failed payment" }).click();
    await expect(owner.getByRole("status")).toContainText("not completed");
    await owner.getByRole("link", { name: "Try again" }).click();
    await owner.getByRole("button", { name: "Pay with test gateway" }).click();
    await owner.getByRole("link", { name: "Simulate successful payment" }).click();
    await expect(owner.getByRole("status")).toContainText("Payment received");
    const p = await props().findOne({ _id: oid(id) });
    expect(p?.status).toBe("PENDING_REVIEW");
    const pay = await payments().findOne({ property: oid(id) });
    expect(pay?.status).toBe("COMPLETED");
    expect(pay?.amountNpr).toBe(6000);

    // Receipt PDF
    const pdf = await owner.request.get(`/api/invoices/${pay!._id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    // …and nobody else can read it
    expect((await owner.context().browser()!.newPage().then((x) => x.request.get(`/api/invoices/${pay!._id}`))).status()).toBe(404);
  });

  test("bank transfer is verified by staff", async () => {
    test.setTimeout(120_000);
    const { id, code } = await cloneDraft();
    await owner.goto(`/en/dashboard/listings/${id}/edit?step=8`);
    await owner.getByRole("button", { name: "Continue to payment" }).click();
    await owner.getByText("Bank transfer", { exact: true }).click();
    await owner.getByLabel("Transfer reference / voucher no.").fill("NIC-778812");
    await owner.getByLabel("Deposit slip (photo or PDF)").setInputFiles(path.join(process.cwd(), "public/uploads/demo/land-2-400.webp"));
    await owner.getByRole("button", { name: "Submit bank transfer" }).click();
    await expect(owner.getByRole("status")).toContainText("being checked");

    await admin.goto("/en/admin/payments");
    const row = admin.locator("tr", { hasText: code });
    await expect(row).toContainText("PENDING_VERIFICATION");
    const slip = await row.getByRole("link", { name: "View slip" }).getAttribute("href");
    expect((await admin.request.get(slip!)).status()).toBe(200);
    expect((await owner.request.get(slip!)).status()).toBe(404); // owners can't browse private files
    admin.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Confirm received" }).click();
    await expect(admin.locator("tr", { hasText: code })).toHaveCount(0); // leaves the pending list
    expect((await props().findOne({ _id: oid(id) }))?.status).toBe("PENDING_REVIEW");
    expect((await payments().findOne({ property: oid(id) }))?.status).toBe("COMPLETED");
  });

  test("renewal activates the new plan right after payment", async () => {
    test.setTimeout(120_000);
    const top = await mongoose.connection.collection("plans").findOne({ slug: "top" });
    const { id } = await cloneDraft("EXPIRED", { slug: `renew-test-${Date.now()}`, title: { en: "Renewal test land", ne: "" }, tier: "NORMAL", tierRank: 0, expiresAt: new Date(Date.now() - 86_400_000) });
    await owner.goto("/en/dashboard/listings?status=EXPIRED");
    await owner.locator("li", { hasText: "Renewal test land" }).getByRole("link", { name: "Renew / upgrade" }).click();
    await owner.getByRole("radio", { name: /^Top/ }).check({ force: true });
    await owner.getByRole("button", { name: "Continue to payment" }).click();
    await owner.getByRole("button", { name: "Pay with test gateway" }).click();
    await owner.getByRole("link", { name: "Simulate successful payment" }).click();
    await expect(owner.getByRole("status")).toContainText("new plan is active");
    const p = await props().findOne({ _id: oid(id) });
    expect(p?.status).toBe("ACTIVE");
    expect(p?.tier).toBe("TOP");
    expect(String(p?.currentPlan)).toBe(String(top!._id));
    expect(new Date(p!.expiresAt).getTime()).toBeGreaterThan(Date.now() + 299 * 86_400_000);
    const sub = await mongoose.connection.collection("subscriptions").findOne({ property: oid(id), status: "ACTIVE" });
    expect(sub?.payment).toBeTruthy();
  });

  test("cron expires listings and sends reminders", async ({ request }) => {
    const { id: due } = await cloneDraft("ACTIVE", { slug: `cron-due-${Date.now()}`, title: { en: "Cron due", ne: "" }, expiresAt: new Date(Date.now() - 60_000) });
    const { id: soon } = await cloneDraft("ACTIVE", { slug: `cron-soon-${Date.now()}`, title: { en: "Cron soon", ne: "" }, expiresAt: new Date(Date.now() + 3 * 86_400_000) });
    await mongoose.connection.collection("subscriptions").insertOne({ property: oid(soon), plan: (await mongoose.connection.collection("plans").findOne({ slug: "normal" }))!._id, user: oid(userId), status: "ACTIVE", startsAt: new Date(), endsAt: new Date(Date.now() + 3 * 86_400_000), remindersSent: [] });

    expect((await request.post("/api/cron/expire-listings", { headers: { authorization: "Bearer wrong-secret-value-123" } })).status()).toBe(404);
    const since = Date.now();
    const res = await request.post("/api/cron/expire-listings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    // Other specs may run the same job in parallel, so check outcomes, not counts.
    expect((await props().findOne({ _id: oid(due) }))?.status).toBe("EXPIRED");
    await waitSms(`+977${phone}`, /ends on/, since);
    // Reminders are sent once.
    await request.post("/api/cron/expire-listings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const sub = await mongoose.connection.collection("subscriptions").findOne({ property: oid(soon) });
    expect(sub?.remindersSent).toEqual(["7d"]);
  });

  test("pricing page offers every plan and hands the choice to the wizard", async ({ page }) => {
    await page.goto("/en/pricing");
    await expect(page.locator("h1")).toHaveText("Pricing plans");
    await expect(page.getByRole("link", { name: /^Choose / })).toHaveCount(5);
    await expect(page.getByRole("table", { name: "Compare plans" })).toContainText("Until sold");
    await page.getByRole("link", { name: "Choose Premium" }).click();
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdashboard%2Fpost%3Fplan%3Dpremium/);
  });
});
