import { z } from "zod";

/** Admin-editable site settings (the single source for contact details, fix #27). */
const i18n = (max: number) => z.object({ en: z.string().trim().max(max), ne: z.string().trim().max(max) });
const url = z.union([z.literal(""), z.string().trim().regex(/^https:\/\/[^\s]+$/).max(300)]);

export const SITE_SETTINGS_SCHEMA = z.object({
  companyName: z.object({ en: z.string().trim().min(2).max(100), ne: z.string().trim().min(2).max(100) }),
  legalName: z.string().trim().max(150),
  registrationNo: z.string().trim().max(60),
  panNo: z.string().trim().regex(/^(\d{9})?$/, "PAN is 9 digits"),
  address: i18n(200),
  geo: z.object({ lat: z.number().min(26).max(31), lng: z.number().min(79).max(89) }),
  phones: z.array(z.string().trim().min(5).max(20)).min(1).max(5),
  whatsapp: z.string().trim().max(20),
  viber: z.string().trim().max(20),
  email: z.string().trim().toLowerCase().email().max(120),
  officeHours: i18n(120),
  social: z.object({ facebook: url, instagram: url, youtube: url, tiktok: url, linkedin: url }),
  about: i18n(10_000),
  bankAccounts: z
    .array(z.object({ bank: z.string().trim().min(2).max(80), accountName: z.string().trim().min(2).max(100), accountNumber: z.string().trim().regex(/^[0-9A-Za-z-]{4,30}$/), branch: z.string().trim().max(80) }))
    .max(5),
  loanRates: z.array(z.object({ bank: z.string().trim().min(2).max(80), ratePct: z.number().min(1).max(30) })).max(30),
});
export type SiteSettingsInput = z.infer<typeof SITE_SETTINGS_SCHEMA>;
