import { Schema, model, models, type Model } from "mongoose";

/** Atomic sequences (`property` → MSR-000123, `invoice` → INV-...). */
export type CounterDoc = { _id: string; seq: number };

const CounterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) ?? model<CounterDoc>("Counter", CounterSchema);
