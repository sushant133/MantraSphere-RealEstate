import "server-only";
import { unstable_cache } from "next/cache";
import { connectDB } from "./db";
import { SiteSetting } from "@/models/System";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-defaults";

export { DEFAULT_SETTINGS, type SiteSettings };

async function loadSettings(): Promise<SiteSettings> {
  if (!process.env.MONGODB_URI) return DEFAULT_SETTINGS;
  try {
    await connectDB();
    const doc = await SiteSetting.findById("site").lean();
    if (!doc) return DEFAULT_SETTINGS;
    const d = doc as unknown as Partial<SiteSettings>;
    const defined = Object.fromEntries(
      Object.entries(d).filter(([k, v]) => v != null && v !== "" && !k.startsWith("_") && k !== "createdAt" && k !== "updatedAt"),
    );
    return {
      ...DEFAULT_SETTINGS,
      ...defined,
      phones: d.phones?.length ? d.phones : DEFAULT_SETTINGS.phones,
      social: { ...DEFAULT_SETTINGS.social, ...(d.social ?? {}) },
    } as SiteSettings;
  } catch (e) {
    console.error("[site] settings fallback:", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
}

/** Cached for an hour; Admin → Settings calls revalidateTag("settings"). */
export const getSiteSettings = unstable_cache(loadSettings, ["site-settings"], {
  tags: ["settings"],
  revalidate: 3600,
});
