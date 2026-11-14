import { afterEach, describe, expect, it } from "vitest";
import { esewaDecode, esewaForm, esewaSign } from "@/lib/payments/esewa";
import { mockReturnUrl, mockVerify } from "@/lib/payments/mock";

const SECRET = "8gBm/:&EnhH.1/q"; // eSewa public test secret

describe("eSewa signing", () => {
  it("matches the documented test vector", () => {
    const sig = esewaSign({ total_amount: "110", transaction_uuid: "241028", product_code: "EPAYTEST" }, ["total_amount", "transaction_uuid", "product_code"], SECRET);
    expect(sig).toBe("i94zsd3oXF6ZsSr/kGqT4sSzYQzjj1W/waxjWyRwaME=");
  });
  it("builds a signed form in test mode", () => {
    const f = esewaForm({ uuid: "INV-000001-ab12", amountNpr: 10000, successUrl: "https://x/s", failureUrl: "https://x/f" });
    expect(f.action).toContain("rc-epay.esewa.com.np");
    expect(f.fields).toMatchObject({ total_amount: "10000", product_code: "EPAYTEST", signed_field_names: "total_amount,transaction_uuid,product_code" });
    expect(f.fields.signature).toBe(esewaSign(f.fields, ["total_amount", "transaction_uuid", "product_code"], SECRET));
  });
  it("accepts genuine callback data and rejects tampering", () => {
    const payload: Record<string, string> = {
      transaction_code: "000AWEO",
      status: "COMPLETE",
      total_amount: "10000",
      transaction_uuid: "INV-000001-ab12",
      product_code: "EPAYTEST",
      signed_field_names: "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names",
    };
    payload.signature = esewaSign(payload, payload.signed_field_names.split(","), SECRET);
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64");
    expect(esewaDecode(enc(payload))?.status).toBe("COMPLETE");
    expect(esewaDecode(enc({ ...payload, total_amount: "1" }))).toBeNull();
    expect(esewaDecode("not-base64-json")).toBeNull();
  });
});

describe("mock gateway", () => {
  const prev = process.env.PAYMENT_MODE;
  afterEach(() => {
    process.env.PAYMENT_MODE = prev;
  });
  it("only accepts signed success links, and only in mock mode", () => {
    process.env.PAYMENT_MODE = "mock";
    const url = new URL(mockReturnUrl("https://x", "a".repeat(24), "success"));
    expect(mockVerify("a".repeat(24), "success", url.searchParams.get("sig")!)).toBe(true);
    expect(mockVerify("b".repeat(24), "success", url.searchParams.get("sig")!)).toBe(false);
    const fail = new URL(mockReturnUrl("https://x", "a".repeat(24), "failure"));
    expect(mockVerify("a".repeat(24), "success", fail.searchParams.get("sig")!)).toBe(false);
    process.env.PAYMENT_MODE = "";
    expect(mockVerify("a".repeat(24), "success", url.searchParams.get("sig")!)).toBe(false);
  });
});
