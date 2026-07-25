const providerLetters: Record<string, string> = {
  OpenAI: 'O',
  Anthropic: 'A',
  Google: 'G',
  DeepSeek: 'D',
  Moonshot: 'K',
  xAI: 'X',
  Mistral: 'M',
  Alibaba: 'Q',
  ByteDance: '豆',
};

export function ProviderMark({ provider, size = 'normal' }: { provider: string; size?: 'small' | 'normal' | 'large' }) {
  return (
    <span className={`provider-mark provider-${provider.toLowerCase().replace(/\s+/g, '-')} ${size}`} aria-hidden="true">
      {providerLetters[provider] ?? provider.slice(0, 1).toUpperCase()}
    </span>
  );
}
