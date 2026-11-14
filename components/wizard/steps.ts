/** Wizard step order. Shared by the client wizard and the server page (deep links via ?step=N). */
export const STEPS = ["location", "area", "price", "details", "photos", "contact", "plan", "review"] as const;
export type Step = (typeof STEPS)[number];
