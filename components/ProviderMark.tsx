import Image from "next/image";
import { IconCpu } from "@tabler/icons-react";
const icons: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "gemini-color",
  DeepSeek: "deepseek-color",
  Alibaba: "qwen-color",
  ByteDance: "doubao-color",
  Moonshot: "kimi-color",
  ZAI: "zai",
  MiniMax: "minimax-color",
  xAI: "grok",
  Mistral: "mistral-color",
};
export function ProviderMark({
  provider,
  size = "normal",
}: {
  provider: string;
  size?: "small" | "normal" | "large";
}) {
  const pixels = size === "large" ? 36 : size === "small" ? 20 : 24;
  return (
    <span className="vendor-icon" aria-hidden="true">
      {icons[provider] ? (
        <Image
          src={`/providers/${icons[provider]}.svg`}
          width={pixels}
          height={pixels}
          alt=""
          unoptimized
        />
      ) : (
        <IconCpu size={pixels} stroke={1.5} />
      )}
    </span>
  );
}
