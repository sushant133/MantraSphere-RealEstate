import { expect, test, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import mongoose from "mongoose";

/**
 * Phase 6: content pages, blog, tools, compare, saved properties sync,
 * saved-search alerts and PWA. Server: SMS_PROVIDER=outbox, CRON_SECRET set.
 */
config({ path: ".env.local" });
const SMS = path.join(process.cwd(), ".outbox", "sms");

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

const randomMobile = () => `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

test.describe("content and tools", () => {
  test("about, FAQ and legal pages render real content", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page.locator("h1")).toHaveText("About us");
    await expect(page.getByText("MantraSphere Innovations Pvt. Ltd.").first()).toBeVisible();
    await page.goto("/en/faq");
    await expect(page.locator("h1")).toHaveText("Frequently asked questions");
    await page.getByText("Is it free to search and contact owners?").click();
    await expect(page.getByText(/Only owners and agents pay/)).toBeVisible();
    await page.goto("/ne/privacy");
    await expect(page.locator("h1")).toHaveText("गोपनीयता नीति");
    await expect(page.getByText(/not yet available in Nepali|नेपालीमा उपलब्ध छैन/)).toBeVisible();
    await expect(page.locator("article .md h2").first()).toHaveText("What we collect");
  });

  test("contact form creates a lead", async ({ page }) => {
    await page.goto("/en/contact");
    const name = `Contact Test ${Date.now()}`;
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Phone number").fill("9841000000");
    await page.getByLabel("What is it about?").selectOption("SELL");
    await page.getByRole("textbox", { name: "Message" }).fill("I want to list two plots of land in Lahan.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("We received your message", { timeout: 20_000 });
    await mongoose.connect(process.env.MONGODB_URI!);
    const lead = await mongoose.connection.collection("leads").findOne({ name });
    expect(lead?.source).toBe("CONTACT_PAGE");
    expect(lead?.message).toBe("[SELL] I want to list two plots of land in Lahan.");
    await mongoose.connection.collection("leads").deleteOne({ _id: lead!._id });
    await mongoose.disconnect();
  });

  test("blog list links to an article with structured data", async ({ page }) => {
    await page.goto("/en/blog");
    await page.getByRole("link", { name: "A checklist before you buy land in Nepal" }).click();
    await expect(page).toHaveURL(/\/en\/blog\/checklist-before-buying-land-in-nepal$/);
    await expect(page.locator("h1")).toHaveText("A checklist before you buy land in Nepal");
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.some((s) => s.includes('"BlogPosting"'))).toBe(true);
    expect((await page.request.get("/en/blog/does-not-exist")).status()).toBe(404);
  });

  test("EMI calculator and land converter compute correctly", async ({ page }) => {
    await page.goto("/en/tools/emi-calculator");
    await page.getByLabel("Loan amount (NPR)").fill("50 lakh");
    await page.getByLabel("Interest rate (% per year)").fill("10");
    await page.getByRole("spinbutton", { name: "Loan period (years)" }).fill("20");
    await expect(page.getByText("Rs 48,251", { exact: true })).toBeVisible();
    await expect(page.getByText("In words: Rs 50 Lakh")).toBeVisible();

    await page.goto("/en/tools/land-unit-converter");
    await page.getByLabel("Area", { exact: true }).fill("1");
    await page.getByLabel("Unit", { exact: true }).selectOption("ROPANI");
    await expect(page.getByRole("row", { name: /Square feet\s+5,476/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /^Aana\s+16$/ })).toBeVisible();
  });
});

test.describe("compare", () => {
  test("pick two listings and compare them", async ({ page }) => {
    await page.goto("/en/properties?type=land");
    const cards = page.locator("main ul > li article"); // results grid, stable order
    await cards.nth(0).getByRole("button", { name: "Compare" }).click();
    await cards.nth(1).getByRole("button", { name: "Compare" }).click();
    const bar = page.getByRole("region", { name: "Properties to compare" });
    await expect(bar).toContainText("2 properties selected");
    // A fourth pick is refused with one announced message.
    await cards.nth(2).getByRole("button", { name: "Compare" }).click();
    await cards.nth(3).getByRole("button", { name: "Compare" }).click();
    await expect(page.getByRole("status")).toContainText("up to 3 properties");
    await expect(bar).toContainText("3 properties selected");
    await cards.nth(2).getByRole("button", { name: "Comparing" }).click();
    await expect(bar).toContainText("2 properties selected");
    await bar.getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/en\/compare\?codes=MSR-\d+,MSR-\d+/);
    const table = page.getByRole("table", { name: "Property comparison" });
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    await expect(table.getByRole("row", { name: /^Price per sq ft/ })).toBeVisible();
    await table.getByRole("button", { name: "Remove" }).first().click();
    await expect(table.getByRole("columnheader")).toHaveCount(1);
  });
});

test.describe("account features", () => {
  test.skip(({ isMobile }) => isMobile, "covered on desktop");
  test.describe.configure({ mode: "serial" });
  const created: mongoose.Types.ObjectId[] = [];

  test.beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
  });
  test.afterAll(async () => {
    await mongoose.connection.collection("properties").deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  });

  test("saved properties sync to the account, saved search sends an alert", async ({ page }) => {
    test.setTimeout(150_000);
    const phone = randomMobile();
    await login(page, phone, "/en/dashboard");
    const user = await mongoose.connection.collection("users").findOne({ phone: `+977${phone}` });

    // The saved page merges this device with the account (and marks the device as signed in).
    const synced = page.waitForResponse((r) => r.url().includes("/api/me/saved"));
    await page.goto("/en/saved");
    await synced;

    // Saving while logged in reaches the account.
    await page.goto("/en/properties?type=land");
    await page.locator("article").first().getByRole("button", { name: "Save property" }).click();
    await expect.poll(async () => mongoose.connection.collection("savedproperties").countDocuments({ user: user!._id }), { timeout: 10_000 }).toBe(1);

    // Save the land search.
    await page.getByRole("link", { name: "Save search" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/searches\?save=/);
    await page.getByLabel("How often").selectOption("INSTANT");
    await expect(page.getByRole("checkbox", { name: /SMS/ })).toBeChecked();
    await page.getByRole("button", { name: "Save search" }).click();
    await expect(page.getByRole("status")).toContainText("Search saved");
    const search = await mongoose.connection.collection("savedsearches").findOne({ user: user!._id });
    expect(search?.query).toBe("type=land");

    // A new matching listing goes live; the hourly job sends one SMS, once.
    const src = await mongoose.connection.collection("properties").findOne({ isDemo: true, type: "LAND", status: "ACTIVE" });
    const { _id, ...rest } = src!;
    void _id;
    const code = `MSR-9${String(Date.now()).slice(-6)}`;
    const ins = await mongoose.connection.collection("properties").insertOne({ ...rest, code, slug: `alert-test-${code.toLowerCase()}`, isDemo: false, publishedAt: new Date(), views: 0 });
    created.push(ins.insertedId);
    await mongoose.connection.collection("savedsearches").updateOne({ _id: search!._id }, { $set: { lastNotifiedAt: new Date(Date.now() - 2 * 3600_000) } });
    // The window starts before the new listing but after the demo data was published.
    await mongoose.connection.collection("properties").updateOne({ _id: ins.insertedId }, { $set: { publishedAt: new Date(Date.now() - 3600_000) } });
    const since = Date.now();
    const cron = () => page.request.post("/api/cron/expire-listings", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    // (Other specs may run the same job in parallel, so check outcomes, not response counts.)
    expect((await cron()).status()).toBe(200);
    const sms = await waitSms(`+977${phone}`, /new propert/, since);
    expect(sms).toContain("/en/properties?type=land");
    const after = await mongoose.connection.collection("savedsearches").findOne({ _id: search!._id });
    expect(new Date(after!.lastNotifiedAt).getTime()).toBeGreaterThanOrEqual(since - 1000);
    // Not due again within the hour: a second run sends nothing more.
    await cron();
    const alerts = async () => {
      let n = 0;
      for (const f of await fs.readdir(SMS)) {
        try {
          const m = JSON.parse(await fs.readFile(path.join(SMS, f), "utf8"));
          if (m.to === `+977${phone}` && /new propert/.test(m.text)) n++;
        } catch {
          /* partial write */
        }
      }
      return n;
    };
    expect(await alerts()).toBe(1);

    // Pause and delete from the dashboard.
    await page.goto("/en/dashboard/searches");
    await page.getByRole("button", { name: /^Pause:/ }).click();
    await expect(page.getByText("Paused")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Delete:/ }).click();
    await expect(page.getByText(/You have no saved searches/)).toBeVisible();
  });
});

test.describe("PWA", () => {
  test("manifest, offline page and service worker", async ({ page, request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m.name).toBe("MantraSphere Real Estate");
    expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
    expect(await (await request.get("/offline.html")).text()).toContain("You are offline");
    await page.goto("/en");
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/$/);
  });
});
