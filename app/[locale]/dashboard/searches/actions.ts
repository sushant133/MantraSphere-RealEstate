"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { FREQUENCIES, MAX_SAVED_SEARCHES, canonicalAlertQuery } from "@/lib/search-alerts";
import { SavedSearch, User } from "@/models";

const objectId = z.string().regex(/^[a-f0-9]{24}$/);
const createSchema = z.object({
  query: z.string().max(1000),
  name: z.string().trim().max(80),
  frequency: z.enum(FREQUENCIES),
  email: z.boolean(),
  sms: z.boolean(),
});

export type SearchResult = { ok: true } | { ok: false; error: "invalid" | "limit" | "no_channel" | "duplicate" | "rate_limited" };

export async function createSavedSearch(input: z.input<typeof createSchema>): Promise<SearchResult> {
  const user = await assertUser();
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (!rateLimit(`saved-search:${user.id}`, 30, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };
  await connectDB();
  const u = await User.findById(user.id).select("email emailVerified phone").lean();
  // Only channels the account can actually receive.
  const channels = [...(p.data.email && u?.email && u.emailVerified ? ["EMAIL"] : []), ...(p.data.sms && u?.phone ? ["SMS"] : [])];
  if (!channels.length) return { ok: false, error: "no_channel" };
  const query = canonicalAlertQuery(p.data.query);
  if ((await SavedSearch.countDocuments({ user: user.id })) >= MAX_SAVED_SEARCHES) return { ok: false, error: "limit" };
  if (await SavedSearch.exists({ user: user.id, query })) return { ok: false, error: "duplicate" };
  await SavedSearch.create({ user: user.id, query, name: p.data.name || undefined, frequency: p.data.frequency, channels, active: true });
  revalidatePath("/[locale]/dashboard/searches", "page");
  return { ok: true };
}

export async function setSavedSearchActive(id: string, active: boolean): Promise<SearchResult> {
  const user = await assertUser();
  if (!objectId.safeParse(id).success) return { ok: false, error: "invalid" };
  await connectDB();
  // Resuming starts the window now, so old listings aren't sent in a burst.
  await SavedSearch.updateOne({ _id: id, user: user.id }, { $set: active ? { active, lastNotifiedAt: new Date() } : { active } });
  revalidatePath("/[locale]/dashboard/searches", "page");
  return { ok: true };
}

export async function deleteSavedSearch(id: string): Promise<SearchResult> {
  const user = await assertUser();
  if (!objectId.safeParse(id).success) return { ok: false, error: "invalid" };
  await connectDB();
  await SavedSearch.deleteOne({ _id: id, user: user.id });
  revalidatePath("/[locale]/dashboard/searches", "page");
  return { ok: true };
}
