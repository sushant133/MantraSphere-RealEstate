import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PropertyCard } from "@/components/property/PropertyCard";
import type { PropertyCardDTO } from "@/lib/properties/dto";
import { cn } from "@/lib/utils";
import { RailControls } from "./RailControls";

/**
 * A home-page section: up to 8 cards in a swipeable row (no orphan rows on
 * any screen) + "View all" (fix #8). Renders nothing when empty.
 */
export function HomeSection({
  id,
  eyebrow,
  title,
  subtitle,
  items,
  viewAllHref,
  viewAllLabel,
  railLabels,
  tinted = false,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: PropertyCardDTO[];
  viewAllHref: string;
  viewAllLabel: string;
  railLabels: { prev: string; next: string };
  tinted?: boolean;
}) {
  if (!items.length) return null;
  const railId = `rail-${id}`;
  return (
    <section aria-labelledby={`${id}-title`} className={cn("py-12 sm:py-16", tinted && "bg-navy-50/60")}>
      <div className="container-wide">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">{eyebrow}</p> : null}
            <h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {title}
            </h2>
            {subtitle ? <p className="mt-1.5 text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <Link href={viewAllHref} className="tap inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:underline">
              {viewAllLabel}
              <span className="sr-only">: {title}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <RailControls railId={railId} labels={railLabels} />
          </div>
        </div>
        {/* No CSS scroll-behavior: smooth here. With snap it animates the first layout snap, which Chrome
            counts as a scroll and then never reports LCP for the page. The arrow buttons scroll smoothly themselves. */}
        <ul id={railId} className="rail -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-3 pt-1">
          {items.slice(0, 8).map((p) => (
            <li
              key={p.id}
              className="flex w-[82%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)] 2xl:w-[calc((100%-5rem)/5)]"
            >
              <PropertyCard p={p} sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 82vw" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
