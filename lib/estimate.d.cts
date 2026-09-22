import type { Model } from "./data";
export function estimateCost(
  model: Pick<Model, "input" | "cachedInput" | "output">,
  input: number,
  output: number,
  cachePercent: number,
):
  | {
      error: string;
      total?: never;
      inputCost?: never;
      cacheCost?: never;
      outputCost?: never;
    }
  | {
      error?: never;
      total: number;
      inputCost: number;
      cacheCost: number;
      outputCost: number;
    };
export function needsReview(value?: string, now?: number): boolean;
