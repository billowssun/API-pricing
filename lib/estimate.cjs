// Standard text tokens only: no inferred FX, context tiers, or discounts.
function estimateCost(model, input, output, cachePercent) {
  if (
    ![input, output, cachePercent].every(Number.isFinite) ||
    input < 0 ||
    output < 0 ||
    cachePercent < 0 ||
    cachePercent > 100
  )
    return { error: "请输入有效的非负用量，缓存命中率应在 0–100% 之间。" };
  const cacheTokens = (input * cachePercent) / 100;
  const normalTokens = input - cacheTokens;
  const validPrice = (p) =>
    typeof p === "number" && Number.isFinite(p) && p >= 0;
  if (
    (normalTokens > 0 && !validPrice(model.input)) ||
    (output > 0 && !validPrice(model.output)) ||
    (cacheTokens > 0 && !validPrice(model.cachedInput))
  )
    return {
      error:
        "所选用量需要的单价未提供，无法可靠估算。请核对来源或将缓存命中率设为 0%。",
    };
  const inputCost = normalTokens ? (normalTokens / 1e6) * model.input : 0;
  const cacheCost = cacheTokens ? (cacheTokens / 1e6) * model.cachedInput : 0;
  const outputCost = output ? (output / 1e6) * model.output : 0;
  const total = inputCost + cacheCost + outputCost;
  if (!Number.isFinite(total)) return { error: "用量过大，请输入较小的数值。" };
  return { inputCost, cacheCost, outputCost, total };
}
function needsReview(value, now = Date.now()) {
  const date = Date.parse(value || "");
  return !Number.isFinite(date) || date > now || now - date > 30 * 86400000;
}
module.exports = { estimateCost, needsReview };
