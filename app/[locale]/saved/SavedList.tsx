"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PropertyCard } from "@/components/property/PropertyCard";
import { syncSaved, useSavedCodes } from "@/components/property/SaveButton";
import type { PropertyCardDTO } from "@/lib/properties/dto";

export function SavedList() {
  const t = useTranslations("saved");
  const codes = useSavedCodes();
  const key = codes.join(",");
  const [items, setItems] = useState<PropertyCardDTO[] | null>(null);

  // Pull in properties saved on other devices when logged in.
  useEffect(() => {
    void syncSaved();
  }, []);

  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/properties?codes=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d: { items: PropertyCardDTO[] }) => !cancelled && setItems(d.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (items === null) return <p className="text-muted-foreground">{t("loading")}</p>;
  // Hide cards that were un-saved since the fetch (optimistic).
  const visible = items.filter((p) => codes.includes(p.code));
  if (!visible.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
        <Heart className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-medium">{t("empty")}</p>
        <Link href="/properties" className="tap mt-6 inline-flex items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
          {t("browse")}
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((p) => (
        <li key={p.id} className="flex">
          <PropertyCard p={p} headingLevel={2} />
        </li>
      ))}
    </ul>
  );
}
