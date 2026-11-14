import { describe, expect, it } from "vitest";
import { loanSummary, monthlyEmi } from "@/lib/emi";
import { markdownToText, readingMinutes, renderMarkdown } from "@/lib/markdown";
import { parseFilters } from "@/lib/properties/filters";
import { canonicalAlertQuery, isDue, newListingsFilter } from "@/lib/search-alerts-core";

describe("markdown rendering", () => {
  it("escapes raw HTML and drops dangerous links", () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror="x()"> [bad](javascript:alert(1)) [ok](/en/pricing)');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<a href="/en/pricing">ok</a>');
    expect(html).toContain("bad"); // link text survives as plain text
  });
  it("demotes headings below the page h1 and marks external links", () => {
    const html = renderMarkdown("# Title\n\n## Part\n\n[site](https://example.com)");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<h3>Part</h3>");
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });
  it("renders inline formatting and lists", () => {
    expect(renderMarkdown("**bold** and *em*\n\n- a\n- b")).toBe("<p><strong>bold</strong> and <em>em</em></p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
  });
  it("gives plain text and reading time", () => {
    expect(markdownToText("## A & B\n\nSome **text**.")).toBe("A & B Some text.");
    expect(readingMinutes("word ".repeat(1000))).toBe(5);
    expect(readingMinutes("")).toBe(1);
  });
});

describe("EMI", () => {
  it("matches the standard reducing-balance formula", () => {
    // Rs 50 lakh, 10%, 20 years → Rs 48,251.08 (standard EMI tables).
    expect(monthlyEmi(5_000_000, 10, 240)).toBeCloseTo(48_251.08, 1);
    expect(monthlyEmi(1_200_000, 0, 12)).toBe(100_000);
    expect(monthlyEmi(0, 10, 12)).toBe(0);
  });
  it("pays the loan off exactly and totals add up", () => {
    const s = loanSummary(5_000_000, 10, 20);
    expect(s.schedule).toHaveLength(20);
    expect(s.schedule.at(-1)!.balance).toBeCloseTo(0, 2);
    const principal = s.schedule.reduce((a, r) => a + r.principalPaid, 0);
    const interest = s.schedule.reduce((a, r) => a + r.interestPaid, 0);
    expect(principal).toBeCloseTo(5_000_000, 0);
    expect(interest).toBeCloseTo(s.totalInterest, 0);
    // Early years are mostly interest.
    expect(s.schedule[0].interestPaid).toBeGreaterThan(s.schedule[0].principalPaid);
  });
});

describe("saved-search alerts", () => {
  it("stores a canonical query without sort, view, page or sold", () => {
    expect(canonicalAlertQuery("view=map&district=kathmandu&type=land&sort=price_asc&page=3&purpose=sale")).toBe("purpose=sale&type=land&district=kathmandu");
    expect(canonicalAlertQuery("status=sold&type=house")).toBe("type=house");
    expect(canonicalAlertQuery("$where=1&type=nope")).toBe("");
  });
  it("is due according to its frequency", () => {
    const now = new Date("2026-11-14T12:00:00Z");
    const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
    expect(isDue({ frequency: "INSTANT", lastNotifiedAt: ago(1), createdAt: ago(100) }, now)).toBe(true);
    expect(isDue({ frequency: "INSTANT", lastNotifiedAt: ago(0.5), createdAt: ago(100) }, now)).toBe(false);
    expect(isDue({ frequency: "DAILY", lastNotifiedAt: ago(23), createdAt: ago(100) }, now)).toBe(false);
    expect(isDue({ frequency: "DAILY", lastNotifiedAt: null, createdAt: ago(24) }, now)).toBe(true);
    expect(isDue({ frequency: "WEEKLY", lastNotifiedAt: ago(24 * 6), createdAt: ago(1000) }, now)).toBe(false);
    expect(isDue({ frequency: "WEEKLY", lastNotifiedAt: ago(24 * 7), createdAt: ago(1000) }, now)).toBe(true);
  });
  it("matches only active listings published inside the window", () => {
    const since = new Date("2026-11-13T12:00:00Z");
    const now = new Date("2026-11-14T12:00:00Z");
    const q = newListingsFilter(parseFilters({ type: "land", max: "5000000", within: "7", status: "sold" }), {}, since, now);
    expect(q.status).toBe("ACTIVE");
    expect(q.type).toBe("LAND");
    expect(q.priceTotalNpr).toEqual({ $lte: 5_000_000 });
    expect(q.publishedAt).toEqual({ $gt: since, $lte: now });
    expect(q.createdAt).toBeUndefined(); // "posted within" is replaced by the alert window
  });
});
