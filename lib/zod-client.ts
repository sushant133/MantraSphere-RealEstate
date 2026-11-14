import { z } from "zod";

/**
 * Zod for browser code. `jitless` stops Zod probing `new Function("")`,
 * which our Content-Security-Policy (no 'unsafe-eval') blocks and reports
 * as a console/CSP issue. Validation behaves the same.
 */
z.config({ jitless: true });

export { z };
