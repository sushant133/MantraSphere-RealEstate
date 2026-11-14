/**
 * Contact details, social links and office hours come from ONE admin-editable
 * record (fix #27). These defaults seed that record and are the fallback if
 * the database is unreachable, so the header/footer never render empty.
 */
export type SiteSettings = {
  companyName: { en: string; ne: string };
  legalName: string;
  registrationNo: string;
  panNo: string;
  address: { en: string; ne: string };
  geo: { lat: number; lng: number };
  phones: string[]; // E.164
  whatsapp: string;
  viber: string;
  email: string;
  officeHours: { en: string; ne: string };
  social: Partial<Record<"facebook" | "instagram" | "youtube" | "tiktok" | "linkedin", string>>;
  /** Markdown; the About page falls back to its built-in text when empty. */
  about?: { en?: string; ne?: string };
  loanRates?: { bank: string; ratePct: number; updatedAt?: Date | string }[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  companyName: { en: "MantraSphere Real Estate", ne: "मन्त्रास्फियर रियल इस्टेट" },
  legalName: "MantraSphere Innovations Pvt. Ltd.",
  registrationNo: "",
  panNo: "",
  address: { en: "Dhangadhimai-10, Siraha, Nepal", ne: "धनगढीमाई-१०, सिराहा, नेपाल" },
  // Approximate; confirm the exact office pin in Admin → Settings.
  geo: { lat: 26.7339, lng: 86.3417 },
  phones: ["+9779849361011", "+9779824763981"],
  whatsapp: "+9779849361011",
  viber: "+9779849361011",
  email: "info@mantrasphere.com.np",
  officeHours: { en: "Sun–Fri, 10:00 AM – 6:00 PM", ne: "आइत–शुक्र, बिहान १०:०० – बेलुका ६:००" },
  social: {},
};
