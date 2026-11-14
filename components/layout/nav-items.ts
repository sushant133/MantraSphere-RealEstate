/** Primary navigation. Absolute, locale-relative routes only (fix #13). */
export const PRIMARY_NAV = [
  { key: "buy", href: "/properties?purpose=sale" },
  { key: "rent", href: "/properties?purpose=rent" },
  { key: "land", href: "/properties?type=land" },
  { key: "commercial", href: "/properties?type=commercial" },
  { key: "pricing", href: "/pricing" },
] as const;

export const SECONDARY_NAV = [
  { key: "about", href: "/about" },
  { key: "blog", href: "/blog" },
  { key: "contact", href: "/contact" },
] as const;
