import "server-only";
import { unstable_cache } from "next/cache";
import { connectDB } from "./db";
import type { Locale } from "./constants";
import { BlogPost, Faq, StaticPage } from "@/models";

/** Cached reads for CMS content. Admin saves revalidate the matching tag. */

type I18n = { en: string; ne: string };
const pair = (v: { en?: string | null; ne?: string | null } | null | undefined): I18n => ({ en: v?.en ?? "", ne: v?.ne ?? "" });

/** Text in the requested language, falling back to English; `lang` says which one was used. */
export function pick(v: I18n, locale: Locale): { text: string; lang: Locale } {
  return locale === "ne" && v.ne.trim() ? { text: v.ne, lang: "ne" } : { text: v.en, lang: "en" };
}

export type FaqItem = { id: string; category: string; q: I18n; a: I18n };

export const getAllFaqs = unstable_cache(
  async (): Promise<FaqItem[]> => {
    await connectDB();
    const rows = await Faq.find({ active: true }).sort({ category: 1, order: 1 }).lean();
    return rows.map((f) => ({ id: String(f._id), category: f.category ?? "GENERAL", q: pair(f.question), a: pair(f.answer) }));
  },
  ["faqs-all-v1"],
  { tags: ["faqs"], revalidate: 3600 },
);

export type LegalPage = { slug: string; title: I18n; summary: I18n; body: I18n; updatedAt: string };

export const getStaticPage = unstable_cache(
  async (slug: "privacy" | "terms"): Promise<LegalPage | null> => {
    await connectDB();
    const p = await StaticPage.findOne({ slug }).lean();
    if (!p) return null;
    return { slug, title: pair(p.title), summary: pair(p.summary), body: pair(p.body), updatedAt: (p.updatedAt ?? new Date()).toISOString() };
  },
  ["static-page-v1"],
  { tags: ["pages"], revalidate: 3600 },
);

export const BLOG_PAGE_SIZE = 9;

export type BlogCard = {
  slug: string;
  title: I18n;
  excerpt: I18n;
  cover: { url: string; alt: string; width: number; height: number } | null;
  tags: string[];
  publishedAt: string;
};
export type BlogArticle = BlogCard & { body: I18n; updatedAt: string };

const published = () => ({ status: "PUBLISHED", publishedAt: { $lte: new Date() } });

function toCard(d: Record<string, unknown>): BlogCard {
  const c = d.coverImage as { url?: string; alt?: string; width?: number; height?: number } | undefined;
  return {
    slug: d.slug as string,
    title: pair(d.title as I18n),
    excerpt: pair(d.excerpt as I18n),
    cover: c?.url ? { url: c.url, alt: c.alt ?? "", width: c.width ?? 1200, height: c.height ?? 800 } : null,
    tags: (d.tags as string[]) ?? [],
    publishedAt: ((d.publishedAt as Date) ?? new Date()).toISOString(),
  };
}

export const getBlogPage = unstable_cache(
  async (page: number): Promise<{ items: BlogCard[]; total: number; pages: number }> => {
    await connectDB();
    // Server-built operators go through the native driver (sanitizeFilter is global).
    const col = BlogPost.collection;
    const filter = published();
    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter, { projection: { body: 0 }, sort: { publishedAt: -1, _id: -1 }, skip: (page - 1) * BLOG_PAGE_SIZE, limit: BLOG_PAGE_SIZE })
        .toArray(),
    ]);
    return { items: docs.map((d) => toCard(d)), total, pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)) };
  },
  ["blog-page-v1"],
  { tags: ["blog"], revalidate: 3600 },
);

export const getBlogPost = unstable_cache(
  async (slug: string): Promise<BlogArticle | null> => {
    await connectDB();
    const d = await BlogPost.collection.findOne({ slug, ...published() });
    if (!d) return null;
    return { ...toCard(d), body: pair(d.body as I18n), updatedAt: ((d.updatedAt as Date) ?? new Date()).toISOString() };
  },
  ["blog-post-v1"],
  { tags: ["blog"], revalidate: 3600 },
);

export const getRecentPosts = unstable_cache(
  async (exclude: string, limit = 3): Promise<BlogCard[]> => {
    await connectDB();
    const docs = await BlogPost.collection
      .find({ ...published(), slug: { $ne: exclude } }, { projection: { body: 0 }, sort: { publishedAt: -1 }, limit })
      .toArray();
    return docs.map((d) => toCard(d));
  },
  ["blog-recent-v1"],
  { tags: ["blog"], revalidate: 3600 },
);

export async function getSitemapPosts(): Promise<{ slug: string; updatedAt: string }[]> {
  await connectDB();
  const docs = await BlogPost.collection.find(published(), { projection: { slug: 1, updatedAt: 1 } }).toArray();
  return docs.map((d) => ({ slug: d.slug as string, updatedAt: ((d.updatedAt as Date) ?? new Date()).toISOString() }));
}
