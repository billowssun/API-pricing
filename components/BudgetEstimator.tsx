"use client";
import { useState } from "react";
import { IconCalculator, IconArrowUpRight } from "@tabler/icons-react";
import type { Model } from "@/lib/data";
import { estimateCost } from "@/lib/estimate.cjs";
export function BudgetEstimator({ models }: { models: Model[] }) {
  const [id, setId] = useState(
    models.find((m) => m.name === "GPT-5.6 Sol")?.id || models[0]?.id || "",
  );
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [cache, setCache] = useState("0");
  const [submitted, setSubmitted] = useState(false);
  const model = models.find((m) => m.id === id);
  const result: ReturnType<typeof estimateCost> | null =
    submitted && model
      ? input.trim() === "" || output.trim() === "" || cache.trim() === ""
        ? { error: "请填写输入、输出用量和缓存命中率；没有用量时请填 0。" }
        : estimateCost(model, Number(input), Number(output), Number(cache))
      : null;
  const money = (value: number) =>
    `${model?.baseCurrency === "CNY" ? "¥" : "$"}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  return (
    <div className="mini-window estimator">
      <div className="window-title">
        <span>
          <IconCalculator size={14} /> API 成本估算
        </span>
        <span>CALCULATOR</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        noValidate
      >
        <label className="estimator-model">
          选择模型
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setSubmitted(false);
            }}
          >
            {models.map((m) => (
              <option value={m.id} key={m.id}>
                {m.provider} / {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="estimator-fields">
          <label>
            每月输入 tokens
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="例如 1000000"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSubmitted(false);
              }}
            />
          </label>
          <label>
            每月输出 tokens
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="例如 200000"
              value={output}
              onChange={(e) => {
                setOutput(e.target.value);
                setSubmitted(false);
              }}
            />
          </label>
          <label>
            缓存命中率（%）
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="any"
              value={cache}
              onChange={(e) => {
                setCache(e.target.value);
                setSubmitted(false);
              }}
            />
          </label>
          <button className="solid-button" type="submit" disabled={!model}>
            计算成本
          </button>
        </div>
        <div className="estimate-result" aria-live="polite" aria-atomic="true">
          <span>预计每月文本成本 · {model?.baseCurrency}</span>
          <strong>
            {result && !result.error && result.total != null
              ? money(result.total)
              : "—"}
          </strong>
          {result?.error ? (
            <p role="alert">{result.error}</p>
          ) : result && result.total != null ? (
            <p>
              输入 {money(result.inputCost!)} / 缓存 {money(result.cacheCost!)}{" "}
              / 输出 {money(result.outputCost!)}
            </p>
          ) : (
            <p>填写用量后计算，不会发送或保存你的输入。</p>
          )}
        </div>
        {model ? (
          <p className="estimate-caveat">
            {model.pricingNote ||
              "按标准文本 token 单价计算，不包含额外服务费用。"}{" "}
            <a href={model.source} target="_blank" rel="noreferrer">
              核对{model.priceStatus === "official" ? "官方" : "聚合"}报价{" "}
              <IconArrowUpRight size={12} />
            </a>
            <span>
              价格核验：{model.lastVerifiedAt?.slice(0, 10) || "未记录"}
              。结果仅作估算，以实际账单为准。
            </span>
          </p>
        ) : null}
      </form>
    </div>
  );
}
