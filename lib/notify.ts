import "server-only";
import { connectDB } from "./db";
import { esc, sendEmail, sendSms } from "./messaging";
import { formatPhoneDisplay } from "./phone";
import { absoluteUrl } from "./seo";
import { User } from "@/models";

/**
 * Tell the listing owner about a new enquiry by email and SMS. Never throws:
 * a messaging outage must not lose the lead (it is already saved).
 */
export async function notifyNewLead(lead: { ownerId: string; code: string; name: string; phone: string; message: string }) {
  try {
    await connectDB();
    const owner = await User.findById(lead.ownerId).select("email emailVerified phone locale name").lean();
    if (!owner) return;
    const ne = owner.locale === "ne";
    const inbox = absoluteUrl(ne ? "ne" : "en", "/dashboard/leads");
    const phone = formatPhoneDisplay(lead.phone);
    const jobs: Promise<unknown>[] = [];
    if (owner.email && owner.emailVerified) {
      jobs.push(
        sendEmail({
          to: owner.email,
          subject: ne ? `${lead.code} मा नयाँ सोधपुछ` : `New enquiry for ${lead.code}`,
          text: `${ne ? "नाम" : "Name"}: ${lead.name}\n${ne ? "फोन" : "Phone"}: ${phone}\n\n${lead.message}\n\n${inbox}`,
          html: `<p><strong>${esc(lead.name)}</strong> · <a href="tel:${esc(lead.phone)}">${esc(phone)}</a></p><p>${esc(lead.message).replace(/\n/g, "<br>")}</p><p><a href="${esc(inbox)}">${ne ? "सोधपुछ हेर्नुहोस्" : "Open your leads"}</a></p>`,
        }),
      );
    }
    if (owner.phone) {
      jobs.push(
        sendSms(
          owner.phone,
          ne
            ? `मन्त्रास्फियर: ${lead.code} मा ${lead.name} (${phone}) बाट सोधपुछ। ${inbox}`
            : `MantraSphere: new enquiry on ${lead.code} from ${lead.name} (${phone}). ${inbox}`,
        ),
      );
    }
    const results = await Promise.allSettled(jobs);
    results.forEach((r) => r.status === "rejected" && console.error("[notify] lead", (r.reason as Error).message));
  } catch (e) {
    console.error("[notify] lead", (e as Error).message);
  }
}
