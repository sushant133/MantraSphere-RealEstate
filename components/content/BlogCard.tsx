import Image from "next/image";
import { Newspaper } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/constants";
import { pick, type BlogCard as Card } from "@/lib/content";
import { formatDate } from "@/lib/properties/format";

export function BlogCard({ post, locale, headingLevel = 2 }: { post: Card; locale: Locale; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const title = pick(post.title, locale);
  const excerpt = pick(post.excerpt, locale);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-primary to-navy-900">
        {post.cover ? (
          <Image src={post.cover.url} alt={post.cover.alt} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 46vw, 100vw" className="object-cover" />
        ) : (
          <Newspaper className="absolute inset-0 m-auto size-12 text-white/70" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-medium text-muted-foreground">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
        </p>
        <H lang={title.lang} className="text-lg font-semibold leading-snug">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none">
            {title.text}
          </Link>
        </H>
        {excerpt.text ? (
          <p lang={excerpt.lang} className="line-clamp-3 text-sm text-muted-foreground">
            {excerpt.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}
