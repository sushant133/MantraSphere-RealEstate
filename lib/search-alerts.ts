import "server-only";
import { getTranslations } from "next-intl/server";
import { connectDB } from "./db";
import type { Locale } from "./constants";
import { esc, sendEmail, sendSms } from "./messaging";
import { filtersToQuery, parseFilters } from "./properties/filters";
import { isDue, newListingsFilter, type Frequency } from "./search-alerts-core";
import { resolveLocation } from "./properties/queries";
import { listingTexts } from "./properties/texts";
import { displayPrice } from "./properties/format";
import { CARD_PROJECTION, toCardDTO } from "./properties/dto";
import { absoluteUrl } from "./seo";
import { Property, SavedSearch, User } from "@/models";

/**
 * Saved searches and their alerts (run from the hourly cron).
 * The stored query is canonical (filtersToQuery) without sort/view/page.
 */
export { FREQUENCIES, MAX_SAVED_SEARCHES, canonicalAlertQuery, type Frequency } from "./search-alerts-core";

export async function describeSearch(query: string, locale: Locale): Promise<string> {
  const f = parseFilters(new URLSearchParams(query));
  const { names } = await resolveLocation(f);
  const { heading } = await listingTexts(locale, f, names, 1);
  return f.q ? `${heading} · “${f.q}”` : heading;
}

export async function runSearchAlerts(now = new Date()): Promise<{ checked: number; sent: number }> {
  await connectDB();
  // Only searches whose period has passed; the oldest first.
  const candidates = await SavedSearch.find({ active: true }).sort({ lastNotifiedAt: 1 }).limit(2000).lean();
  let checked = 0;
  let sent = 0;
  for (const s of candidates) {
    if (!isDue({ frequency: s.frequency as Frequency, lastNotifiedAt: s.lastNotifiedAt, createdAt: s.createdAt }, now)) continue;
    checked++;
    const since = s.lastNotifiedAt ?? s.createdAt;
    try {
      const f = parseFilters(new URLSearchParams(s.query));
      const { ids } = await resolveLocation(f);
      // Native driver: the filter holds server-built operators ($gt, $text…).
      const filter = newListingsFilter(f, ids, since, now);
      const col = Property.collection;
      const [total, docs] = await Promise.all([
        col.countDocuments(filter),
        col.find(filter, { projection: CARD_PROJECTION, sort: { publishedAt: -1 }, limit: 5 }).toArray(),
      ]);
      // Advance the window either way so the same listings are never sent twice.
      await SavedSearch.updateOne({ _id: s._id }, { $set: { lastNotifiedAt: now } });
      if (!total) continue;
      const user = await User.findById(s.user).select("email emailVerified phone locale disabled").lean();
      if (!user || (user as { disabled?: boolean }).disabled) continue;
      const locale: Locale = (user as { locale?: string }).locale === "ne" ? "ne" : "en";
      const cards = docs.map(toCardDTO);
      await deliver({ search: s, user, locale, total, cards });
      sent++;
    } catch (e) {
      console.error("[alerts]", String(s._id), (e as Error).message);
    }
  }
  return { checked, sent };
}

async function deliver(o: {
  search: { _id: unknown; name?: string | null; query: string; channels?: string[] };
  user: { email?: string | null; emailVerified?: Date | null; phone?: string | null };
  locale: Locale;
  total: number;
  cards: ReturnType<typeof toCardDTO>[];
}) {
  const t = await getTranslations({ locale: o.locale, namespace: "searches.alert" });
  const name = o.search.name || (await describeSearch(o.search.query, o.locale));
  const resultsUrl = `${absoluteUrl(o.locale, "/properties")}?${filtersToQuery(parseFilters(new URLSearchParams(o.search.query)), { sort: "newest" })}`;
  const manageUrl = absoluteUrl(o.locale, "/dashboard/searches");
  const channels = o.search.channels ?? ["EMAIL"];

  if (channels.includes("EMAIL") && o.user.email && o.user.emailVerified) {
    const lines = o.cards.map((c) => {
      const pr = displayPrice(c, o.locale);
      return { title: c.title[o.locale] || c.title.en, price: pr ? `${pr.main}${pr.suffix ? ` ${pr.suffix}` : ""}` : t("onRequest"), url: absoluteUrl(o.locale, `/property/${c.slug}`) };
    });
    await sendEmail({
      to: o.user.email,
      subject: t("subject", { count: o.total, name }),
      text: [t("intro", { count: o.total, name }), "", ...lines.map((l) => `• ${l.title} — ${l.price}\n  ${l.url}`), "", `${t("seeAll")}: ${resultsUrl}`, "", `${t("manage")}: ${manageUrl}`].join("\n"),
      html: `<p>${esc(t("intro", { count: o.total, name }))}</p><ul>${lines
        .map((l) => `<li><a href="${esc(l.url)}">${esc(l.title)}</a> — <strong>${esc(l.price)}</strong></li>`)
        .join("")}</ul><p><a href="${esc(resultsUrl)}">${esc(t("seeAll"))}</a></p><p style="color:#666;font-size:12px">${esc(t("why"))} <a href="${esc(manageUrl)}">${esc(t("manage"))}</a></p>`,
    });
  }
  if (channels.includes("SMS") && o.user.phone) {
    await sendSms(o.user.phone, t("sms", { count: o.total, name: name.slice(0, 60), url: resultsUrl }));
  }
}
