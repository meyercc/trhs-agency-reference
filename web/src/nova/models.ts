/**
 * The models the composer can pick. `local` is whatever the settings point
 * at; the vendor rows carry published per-million-token rates with the date
 * they were read, so the tokenomics comparison is to a real price and says
 * when it was true. Display names, not API ids — Nova never calls these; it
 * only prices against them.
 *
 * Rates read from each vendor's published pricing page on `asOf` (standard
 * tier, short context). Re-read and bump the date when they move.
 */
import type { NovaSettings } from '../state/Nova';

export interface NovaModel {
  id: string;
  label: string;
  vendor: 'Anthropic' | 'OpenAI' | 'Google';
  /** USD per 1M input tokens. */
  inPerM: number;
  /** USD per 1M output tokens. */
  outPerM: number;
  /** When the rates were read from the vendor's published pricing. */
  asOf: string;
}

export const LOCAL_MODEL_ID = 'local';
export const RATES_AS_OF = 'October 2, 2026';

export const MODELS: NovaModel[] = [
  { id: 'anthropic-opus-5-5', label: 'Claude Opus 5.5', vendor: 'Anthropic', inPerM: 4, outPerM: 20, asOf: RATES_AS_OF },
  { id: 'anthropic-sonnet-5-5', label: 'Claude Sonnet 5.5', vendor: 'Anthropic', inPerM: 2, outPerM: 10, asOf: RATES_AS_OF },
  { id: 'anthropic-haiku-4-5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', inPerM: 1, outPerM: 5, asOf: RATES_AS_OF },
  { id: 'openai-gpt-6-astra', label: 'GPT-6 Astra', vendor: 'OpenAI', inPerM: 10, outPerM: 50, asOf: RATES_AS_OF },
  { id: 'openai-gpt-6-1-sol', label: 'GPT-6.1 Sol', vendor: 'OpenAI', inPerM: 2, outPerM: 10, asOf: RATES_AS_OF },
  { id: 'google-gemini-3-1-pro', label: 'Gemini 3.1 Pro', vendor: 'Google', inPerM: 2, outPerM: 12, asOf: RATES_AS_OF },
  { id: 'google-gemini-3-8-flash', label: 'Gemini 3.8 Flash', vendor: 'Google', inPerM: 0.75, outPerM: 3.75, asOf: RATES_AS_OF },
];

export const MODEL_BY_ID: Record<string, NovaModel> = Object.fromEntries(MODELS.map((m) => [m.id, m]));

/** Vendor → models, in table order, for a grouped dropdown. */
export const MODELS_BY_VENDOR: { vendor: NovaModel['vendor']; models: NovaModel[] }[] = (['Anthropic', 'OpenAI', 'Google'] as const).map(
  (vendor) => ({ vendor, models: MODELS.filter((m) => m.vendor === vendor) }),
);

/**
 * What a reply costs — or would have cost — in USD. A vendor model prices
 * input and output separately; the local model is priced at the assumed
 * blended cloud rate so the comparison has a number.
 */
export function costUsd(modelId: string, inTokens: number, outTokens: number, settings: Pick<NovaSettings, 'cloudRatePerM'>): number {
  const m = MODEL_BY_ID[modelId];
  if (!m) return ((inTokens + outTokens) / 1e6) * settings.cloudRatePerM;
  return (inTokens / 1e6) * m.inPerM + (outTokens / 1e6) * m.outPerM;
}

/** "$4 / $20 per 1M" — the rate a row shows. */
export function rateLabel(m: NovaModel): string {
  const f = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n}`);
  return `${f(m.inPerM)} in · ${f(m.outPerM)} out per 1M`;
}
