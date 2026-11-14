import { countPublicProperties } from "@/lib/properties/queries";
import { PROPERTIES_PER_FILE, sitemapIndex, xmlResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** /sitemap.xml → index of split sitemap files. */
export async function GET() {
  try {
    const total = await countPublicProperties();
    const files = ["static.xml", "landing.xml", "blog.xml"];
    for (let i = 0; i < Math.max(1, Math.ceil(total / PROPERTIES_PER_FILE)); i++) files.push(`properties-${i}.xml`);
    return xmlResponse(sitemapIndex(files));
  } catch (e) {
    console.error("[sitemap]", (e as Error).message);
    // Never 500: fall back to the static parts.
    return xmlResponse(sitemapIndex(["static.xml"]));
  }
}
