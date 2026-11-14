import type { ClientSession } from "mongoose";
import { Counter } from "@/models/Counter";

/** Atomically increment and return the next value of a named sequence. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  ).lean();
  return doc!.seq;
}

/** 123 → "MSR-000123". */
export function formatPropertyCode(n: number): string {
  return `MSR-${String(n).padStart(6, "0")}`;
}

export async function nextPropertyCode(session?: ClientSession): Promise<string> {
  return formatPropertyCode(await nextSequence("property", session));
}
