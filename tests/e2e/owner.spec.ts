import { expect, test, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Phase 3 flows. The server must run with SMS_PROVIDER=outbox and
 * EMAIL_PROVIDER=outbox so the test can read codes/links from ./.outbox.
 */

const OUTBOX = path.join(process.cwd(), ".outbox");

async function latestMessage(kind: "sms" | "email", match: (m: Record<string, string>) => boolean, sinceMs: number) {
  for (let i = 0; i < 40; i++) {
    const dir = path.join(OUTBOX, kind);
    const files = (await fs.readdir(dir).catch(() => [])).sort().reverse();
    for (const f of files) {
      let m: Record<string, string>;
      try {
        m = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
      } catch {
        continue; // file still being written
      }
      if (new Date(m.at).getTime() >= sinceMs && match(m)) return m as Record<string, string>;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${kind} message found`);
}

const randomMobile = () => `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

async function loginWithOtp(page: Page, phone: string, next = "/en/dashboard") {
  const since = Date.now();
  await page.goto(`/en/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const sms = await latestMessage("sms", (m) => m.to === `+977${phone}`, since);
  const code = sms.text.match(/\b(\d{6})\b/)![1];
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
}

test.describe("owner flows", () => {
  test.skip(({ isMobile }) => isMobile, "long flows run on desktop; mobile layout is covered elsewhere");

  test("dashboard requires login and returns after it", async ({ page }) => {
    await page.goto("/en/dashboard/leads");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdashboard%2Fleads/);
    const phone = randomMobile();
    const since = Date.now();
    await page.getByRole("textbox", { name: "Mobile number" }).fill(phone);
    await page.getByRole("button", { name: "Send code" }).click();
    const sms = await latestMessage("sms", (m) => m.to === `+977${phone}`, since);
    // Wrong code first.
    await page.getByLabel("6-digit code").fill(sms.text.match(/\b(\d{6})\b/)![1] === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("wrong or has expired");
    await page.getByLabel("6-digit code").fill(sms.text.match(/\b(\d{6})\b/)![1]);
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/leads$/);
    await expect(page.locator("h1")).toHaveText("Leads");
  });

  test("email sign-up, verification and password login", async ({ page }) => {
    const email = `owner${Date.now()}@example.com`;
    const since = Date.now();
    await page.goto("/en/register");
    await page.getByLabel("Full name").fill("Sita Karki");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("ghar2025ktm");
    await page.getByLabel("Confirm password").fill("ghar2025ktm");
    await page.getByLabel(/I agree/).check({ force: true });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("status")).toContainText(email);

    // Unverified accounts cannot log in.
    await page.goto("/en/login?method=email");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password").fill("ghar2025ktm");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("verify your email");

    const mail = await latestMessage("email", (m) => m.to === email, since);
    const link = mail.text.match(/https?:\/\/\S+verify-email\?token=[\w-]+/)![0];
    await page.goto(new URL(link).pathname + new URL(link).search);
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.getByRole("status")).toContainText("verified");

    await page.goto("/en/login?method=email");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password").fill("ghar2025ktm");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.locator("h1")).toContainText("Sita Karki");
  });

  test("post a property through the wizard and submit it for review", async ({ page }) => {
    test.setTimeout(180_000);
    await loginWithOtp(page, randomMobile(), "/en/dashboard/post");
    await expect(page.locator("h1")).toHaveText("Post a property");
    await page.getByRole("radio", { name: "Sell", exact: true }).check({ force: true });
    await page.getByRole("radio", { name: "Land", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "Start listing" }).click();
    await expect(page).toHaveURL(/\/dashboard\/listings\/[a-f0-9]{24}\/edit$/);

    // Location
    await page.getByRole("combobox", { name: "District" }).fill("Bhakt");
    await page.getByRole("option", { name: /^Bhaktapur/ }).click();
    await page.getByRole("combobox", { name: /Municipality/ }).fill("Surya");
    await page.getByRole("option", { name: /^Suryabinayak/ }).click();
    await page.getByLabel("Ward no.").selectOption("4");
    await page.getByLabel("Tole / street").fill("Sallaghari");
    const map = page.getByRole("application", { name: "Location on map" });
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await map.click({ position: { x: 200, y: 150 } });
    await expect(page.getByText(/^Pin set at/)).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Area
    await expect(page.locator("h1")).toHaveText("Area");
    await page.getByLabel("Aana").fill("8");
    await expect(page.getByText("8 Aana = 2,738 sq ft")).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Price
    await page.getByLabel("Price in NPR").fill("2.5 crore");
    await expect(page.getByText(/In words: Rs 2 Crore 50 Lakh/)).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Details: a description that contradicts the road width is flagged.
    await page.getByLabel("Facing").selectOption("EAST");
    await page.getByLabel("Road width").fill("13");
    await page.getByLabel("Description in English").fill("Flat land with 20 ft road access, close to Sallaghari bus park.");
    await expect(page.getByText(/mentions 20 for road width \(ft\), but the field says 13/)).toBeVisible();
    await page.getByLabel("Description in English").fill("Flat land with 13 ft road access, close to Sallaghari bus park.");
    await expect(page.getByText(/mentions 20 for road width/)).toHaveCount(0);
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Photos
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "public/uploads/demo/land-1-1600.webp"));
    await expect(page.getByLabel("Describe photo 1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Cover", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Contact (phone pre-filled from the account)
    await page.getByLabel("Contact name").fill("Hari Thapa");
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Plan
    await page.getByRole("radio", { name: /^Premium/ }).check({ force: true });
    await page.getByRole("button", { name: "Save and continue" }).click();

    // Review + submit
    await expect(page.getByText("Everything looks complete.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/checkout\/[a-f0-9]{24}$/);
    await expect(page.getByText(/Rs 10,000/)).toBeVisible();
    await page.getByRole("button", { name: "Pay with test gateway" }).click();
    await page.getByRole("link", { name: "Simulate successful payment" }).click();
    await expect(page).toHaveURL(/\/checkout\/[a-f0-9]{24}\/result$/);
    await expect(page.getByRole("status")).toContainText("Payment received");
    await expect(page.getByRole("status")).toContainText("with our team for review");
    await page.getByRole("link", { name: "Go to my listings" }).click();
    const item = page.locator("li", { hasText: "8 Aana Land for Sale in Suryabinayak, Bhaktapur" }).first();
    await expect(item).toContainText("In review");
  });
});
