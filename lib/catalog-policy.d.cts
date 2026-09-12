import type { Model } from "./data";
export const providers: Array<{
  id: string;
  name: string;
  country: "US" | "CN";
  families: Array<[string, RegExp]>;
}>;
export function selectMainstreamModels(models: Model[], now?: number): Model[];
export function canonical(model: Model): string;
export function applyPriceSchedule(model: Model, now?: number): Model;
