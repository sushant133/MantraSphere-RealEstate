import { expect, test, type Page } from "@playwright/test";

/** Public browsing flows (Phase 2). Needs a seeded database with demo listings. */

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

test("home: one H1, tiered sections, hero search lands on a real URL", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Highlight properties" })).toBeVisible();
  const cards = page.locator("section[aria-labelledby='highlight-title'] > div > ul > li");
  expect(await cards.count()).toBeLessThanOrEqual(8);

  const form = page.getByRole("search");
  await form.getByText("Rent", { exact: true }).click();
  await form.getByLabel("District").selectOption("lalitpur");
  await form.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/en\/properties\?purpose=rent&district=lalitpur$/);
  await expect(page.locator("h1")).toHaveText("Properties for Rent in Lalitpur");
});

test("filters apply instantly and keep state in the URL", async ({ page, isMobile }) => {
  await page.goto("/en/properties");
  if (isMobile) await page.getByRole("button", { name: /^Filters/ }).click();
  await page.locator("#filters-type").selectOption("land");
  await expect(page).toHaveURL(/type=land/);
  await expect(page.locator("h1")).toHaveText("Land in Nepal");
  await page.locator("#sort").selectOption("price_asc", { force: true });
  await expect(page).toHaveURL(/sort=price_asc/);
});

test("detail page: contact reveal, enquiry validation and submission", async ({ page, isMobile }) => {
  await page.goto("/en/properties?purpose=sale&type=house");
  await page.locator("article h2 a").first().click();
  await expect(page).toHaveURL(/\/en\/property\/[a-z0-9-]+-msr-\d{6}$/);
  await expect(page.locator("h1")).toHaveCount(1);

  // Number is not in the HTML until requested.
  await page.getByRole("button", { name: "Show number" }).click();
  await expect(page.locator('a[href^="tel:+977"]').filter({ hasText: "+977" }).first()).toBeVisible();

  const form = page.locator("form[aria-labelledby='enquiry-title']");
  await form.getByLabel("Your name").fill("Test Buyer");
  await form.getByLabel("Mobile number").fill("12345");
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(form.getByText("Enter a valid Nepali mobile number")).toBeVisible();

  await form.getByLabel("Mobile number").fill(isMobile ? "9812345678" : "9801234567");
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("status")).toContainText("Thank you");
});

test("save a property and see it on the saved page", async ({ page }) => {
  await page.goto("/en/properties");
  const first = page.locator("article").first();
  const code = (await first.locator("p.font-mono, span.font-mono").first().textContent())?.trim();
  await first.getByRole("button", { name: "Save property" }).click();
  await expect(first.getByRole("button", { name: "Remove from saved" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/en/saved");
  await expect(page.getByText(code!)).toBeVisible();
});

test("language switch keeps path and query", async ({ page, isMobile }) => {
  test.skip(isMobile, "switcher is in the menu on mobile");
  await page.goto("/en/properties?purpose=rent");
  await page.getByRole("link", { name: /नेपाली/ }).first().click();
  await expect(page).toHaveURL(/\/ne\/properties\?purpose=rent$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ne");
});

test("no horizontal scroll at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const path of ["/en", "/ne", "/en/properties", "/en/land-for-sale-in-bhaktapur"]) {
    await page.goto(path);
    await noHorizontalScroll(page);
  }
  await page.goto("/en/properties?purpose=sale&type=house");
  await page.locator("article h2 a").first().click();
  await noHorizontalScroll(page);
});

test("status codes: 404, 301 for old slugs, canonical redirect", async ({ request }) => {
  expect((await request.get("/en/this-page-does-not-exist")).status()).toBe(404);
  expect((await request.get("/en/castle-for-sale-in-kathmandu")).status()).toBe(404);
  const old = await request.get("/en/property/old-title-msr-000002", { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers()["location"]).toMatch(/\/en\/property\/[a-z0-9-]+-msr-000002$/);
  const messy = await request.get("/en/properties?tab=buy&q=&district=", { maxRedirects: 0 });
  expect(messy.status()).toBe(307);
  expect(messy.headers()["location"]).toMatch(/\/en\/properties\?purpose=sale$/);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
});
