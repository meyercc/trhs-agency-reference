/**
 * The optional local model — an OpenAI-compatible chat-completions endpoint
 * on this machine (llama.cpp's llama-server, Ollama, LM Studio, vLLM). Nova
 * sends anything its script table does not match here when it is enabled,
 * streams the reply in, and reads the token usage the server reports.
 *
 * Failure is the common case, not an error state: nothing may be running,
 * or the browser may refuse the request before it leaves (CORS on Ollama
 * without OLLAMA_ORIGINS; Chrome's private-network rules from a public
 * origin). Every failure resolves to a typed LlmError the engine turns into a
 * plain scripted reply. Nothing here throws anything else.
 */
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  /** The full chat-completions URL, as settings hold it. */
  endpoint: string;
  model: string;
  messages: ChatTurn[];
  signal: AbortSignal;
  onToken: (delta: string) => void;
  /**
   * To the first byte. The default is deliberately short, for the probe-shaped
   * case where "nothing is there" should be said quickly. A real local model
   * needs far longer: Ollama LOADS the model before it answers, and a cold 5 GB
   * load outruns any few-second budget — the reply would read "could not reach
   * it" while the server worked perfectly. Callers on that path pass their own.
   */
  connectTimeoutMs?: number;
  /** Between chunks. */
  idleTimeoutMs?: number;
  /** How long the server should hold the model loaded after answering (Ollama). */
  keepAlive?: string;
  /**
   * A ceiling on the reply. Not a style preference — a latency one: at the ~20
   * tok/s a local 8B manages on a laptop, an unbounded answer to "where would
   * you start" ran 717 tokens and took 51s, which is not a usable chat. The
   * prompt asks for brevity and this is the backstop when it is ignored.
   *
   * ⚠️ On a THINKING model this is a trap on its own. Granite spends tokens on
   * a separate `reasoning` field that `delta.content` never carries, so the cap
   * can be exhausted before a single visible character arrives — a reply that
   * renders as an EMPTY BUBBLE while usage says 320 tokens. Always pair it with
   * `reasoningEffort`.
   */
  maxTokens?: number;
  /**
   * OpenAI's `reasoning_effort`. `'none'` is what Nova wants: it is asking for
   * three grounded sentences, and reasoning is pure latency it then throws away
   * (the tokens are billed and `streamChat` only reads `delta.content`).
   * Measured on granite4.2:8b — the same question costs 149 completion tokens
   * with reasoning and 24 without. Servers that do not know the parameter
   * ignore it, which is the right fallback.
   */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface StreamResult {
  text: string;
  /** Absent when the server did not report it — the caller estimates and says so. */
  usage?: Usage;
  seconds: number;
}

export type LlmErrorKind = 'unreachable' | 'cors' | 'http' | 'timeout' | 'aborted' | 'bad-response';

export class LlmError extends Error {
  kind: LlmErrorKind;
  status?: number;
  constructor(kind: LlmErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
    this.status = status;
  }
}

/** `http://host:port/v1/chat/completions` → `http://host:port/v1`. */
export function apiBase(endpoint: string): string {
  return endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

/** Only a loopback address is allowed — Nova never sends a conversation off the machine. */
export function isLocalEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return (u.protocol === 'http:' || u.protocol === 'https:') && /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(u.hostname);
  } catch {
    return false;
  }
}

function classify(e: unknown): LlmError {
  if (e instanceof LlmError) return e;
  if (e instanceof DOMException && e.name === 'AbortError') return new LlmError('aborted', 'aborted');
  // A fetch that the browser refused (CORS, private-network, nothing
  // listening) surfaces as a TypeError with no status to distinguish them.
  // Nothing listening is the likelier story on a demo machine.
  if (e instanceof TypeError) return new LlmError('unreachable', e.message);
  return new LlmError('unreachable', e instanceof Error ? e.message : String(e));
}

/**
 * POST a streamed chat completion and feed tokens to `onToken` as they
 * arrive. Resolves with the whole text and the usage, if reported — Ollama's
 * /v1 sends it only on the final chunk and some builds never do;
 * `stream_options.include_usage` asks politely and is ignored by servers that
 * do not know it.
 */
export async function streamChat(o: StreamOptions): Promise<StreamResult> {
  const connectTimeoutMs = o.connectTimeoutMs ?? 5000;
  const idleTimeoutMs = o.idleTimeoutMs ?? 20_000;
  if (!isLocalEndpoint(o.endpoint)) throw new LlmError('unreachable', 'The endpoint must be on this machine (localhost).');

  const ac = new AbortController();
  const onOuterAbort = () => ac.abort();
  o.signal.addEventListener('abort', onOuterAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, ms);
  };

  const started = Date.now();
  let text = '';
  let usage: Usage | undefined;
  try {
    arm(connectTimeoutMs);
    const res = await fetch(o.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `keep_alive` is Ollama's; servers that do not know it ignore it. Without
      // it Ollama unloads after 5 idle minutes and the NEXT question pays the
      // cold-load cost again — mid-demo, which is the worst moment for it.
      body: JSON.stringify({ model: o.model, messages: o.messages, stream: true, stream_options: { include_usage: true }, keep_alive: o.keepAlive ?? '30m', ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}), ...(o.reasoningEffort ? { reasoning_effort: o.reasoningEffort } : {}) }),
      signal: ac.signal,
    });
    if (!res.ok) throw new LlmError('http', `${res.status} ${res.statusText}`, res.status);
    if (!res.body) throw new LlmError('bad-response', 'no response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      arm(idleTimeoutMs);
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          buf = '';
          break;
        }
        let json: { choices?: { delta?: { content?: string } }[]; usage?: Usage } | null = null;
        try {
          json = JSON.parse(data);
        } catch {
          continue; // a partial or keep-alive line
        }
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          o.onToken(delta);
        }
        if (json?.usage && typeof json.usage.completion_tokens === 'number') usage = json.usage;
      }
    }
    return { text, usage, seconds: (Date.now() - started) / 1000 };
  } catch (e) {
    if (timedOut) throw new LlmError('timeout', text ? 'the model stopped mid-reply' : 'no reply in time');
    if (o.signal.aborted) throw new LlmError('aborted', 'aborted');
    throw classify(e);
  } finally {
    if (timer) clearTimeout(timer);
    o.signal.removeEventListener('abort', onOuterAbort);
  }
}

export interface JsonRequest {
  endpoint: string;
  model: string;
  messages: ChatTurn[];
  signal: AbortSignal;
  /**
   * A JSON Schema the reply must satisfy, passed as OpenAI's
   * `response_format: { type: 'json_schema' }`. Ollama's `/v1` honours it with
   * real constrained decoding, so the shape is guaranteed rather than hoped for.
   *
   * ⚠️ **Keep it FLAT.** Measured on granite4.2:8b: a schema using `anyOf` with
   * `const` discriminators produced NO RESPONSE in 90 seconds, while the
   * flattened form of the identical request answered in 6. Use objects, bounded
   * integers and — above all — `enum`s, and rebuild any tagged union in
   * TypeScript afterwards. An `enum` is the strongest tool here: inside one, an
   * invalid value is not unlikely, it is impossible.
   */
  schema: unknown;
  /** A name for the schema, which the API requires. */
  schemaName: string;
  connectTimeoutMs?: number;
  maxTokens?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  keepAlive?: string;
}

export interface JsonResult<T> {
  value: T;
  usage?: Usage;
  seconds: number;
}

/**
 * Ask for one JSON object and nothing else. **Not** a variant of `streamChat`,
 * deliberately: that function hardcodes `stream: true`, is watched by four
 * TH-430 checks, and a structured reply has no prose to stream — streaming JSON
 * into a chat bubble would render as a wall of braces.
 *
 * One model call, so the usage ledger still gets exactly one number per reply.
 *
 * Rejects with an `LlmError` and nothing else, same contract as `streamChat`:
 * `bad-response` when the body is not the shape we asked for, which includes a
 * model that returned prose instead of JSON.
 */
export async function requestJson<T>(o: JsonRequest): Promise<JsonResult<T>> {
  if (!isLocalEndpoint(o.endpoint)) throw new LlmError('unreachable', 'The endpoint must be on this machine (localhost).');
  const ac = new AbortController();
  const onOuterAbort = () => ac.abort();
  o.signal.addEventListener('abort', onOuterAbort, { once: true });
  // One budget, not two: there is no stream, so there are no inter-chunk gaps
  // to measure. It has to be generous — a cold model load alone outruns 20s.
  const timer = setTimeout(() => ac.abort(), o.connectTimeoutMs ?? 60_000);
  const started = Date.now();
  try {
    const res = await fetch(o.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: o.model,
        messages: o.messages,
        stream: false,
        temperature: 0,
        keep_alive: o.keepAlive ?? '30m',
        ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
        ...(o.reasoningEffort ? { reasoning_effort: o.reasoningEffort } : {}),
        response_format: { type: 'json_schema', json_schema: { name: o.schemaName, strict: true, schema: o.schema } },
      }),
      signal: ac.signal,
    });
    if (!res.ok) throw new LlmError('http', `${res.status} ${res.statusText}`, res.status);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: Usage;
    };
    const choice = body?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new LlmError('bad-response', 'the reply carried no content');
    let value: T;
    try {
      value = JSON.parse(content) as T;
    } catch {
      // Constrained decoding should make this unreachable, so when it happens
      // the message has to say WHY — "the reply was not JSON" sent me looking
      // at the schema when the real cause was `finish_reason: 'length'`, i.e.
      // valid JSON cut off mid-object by max_tokens. The snippet and the reason
      // are the difference between a diagnosis and a guess. Not user-facing:
      // `explain()` maps the kind, not the message.
      const why = choice?.finish_reason === 'length' ? 'truncated by max_tokens' : 'not JSON';
      throw new LlmError('bad-response', `${why} (finish_reason=${choice?.finish_reason ?? '?'}): ${content.slice(0, 160)}`);
    }
    const usage = body.usage && typeof body.usage.completion_tokens === 'number' ? body.usage : undefined;
    return { value, usage, seconds: (Date.now() - started) / 1000 };
  } catch (e) {
    if (o.signal.aborted) throw new LlmError('aborted', 'aborted');
    if (e instanceof DOMException && e.name === 'AbortError') throw new LlmError('timeout', 'no reply in time');
    throw classify(e);
  } finally {
    clearTimeout(timer);
    o.signal.removeEventListener('abort', onOuterAbort);
  }
}

export type ProbeResult = { ok: true; models: string[]; ms: number } | { ok: false; kind: LlmErrorKind; message: string };

/**
 * "Test connection": GET /v1/models, which llama.cpp, Ollama, LM Studio and
 * vLLM all serve. Returns the model ids so the settings field can offer them.
 */
export async function probe(endpoint: string, timeoutMs = 3000): Promise<ProbeResult> {
  if (!isLocalEndpoint(endpoint)) return { ok: false, kind: 'unreachable', message: 'The endpoint must be on this machine (localhost).' };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${apiBase(endpoint)}/models`, { signal: ac.signal });
    if (!res.ok) return { ok: false, kind: 'http', message: `${res.status} ${res.statusText}` };
    const json = (await res.json()) as { data?: { id?: string }[]; models?: { name?: string }[] };
    // `/v1/models` answers OpenAI-shaped (`data[].id`); Ollama's NATIVE `/api/tags`
    // answers `models[].name`. Read both, or pointing at a native endpoint lists
    // nothing and looks like a server with no models rather than a shape mismatch.
    const models = [
      ...(json.data ?? []).map((m) => m.id),
      ...(json.models ?? []).map((m) => m.name),
    ].filter((x): x is string => !!x);
    return { ok: true, models, ms: Date.now() - started };
  } catch (e) {
    if (ac.signal.aborted) return { ok: false, kind: 'timeout', message: 'no answer in time' };
    const err = classify(e);
    return { ok: false, kind: err.kind, message: err.message };
  } finally {
    clearTimeout(t);
  }
}

/** The one-line explanation the settings panel shows for a failed probe. */
export function explain(kind: LlmErrorKind): string {
  switch (kind) {
    case 'unreachable':
      return 'Nothing answered. Either no server is running at that address, or the browser refused the request — Ollama needs OLLAMA_ORIGINS set to this app’s origin; llama-server allows it by default.';
    case 'cors':
      return 'The browser blocked the request. Allow this origin on the server (OLLAMA_ORIGINS for Ollama).';
    case 'http':
      return 'The server answered with an error. Check the model name and that the endpoint ends in /v1/chat/completions.';
    case 'timeout':
      return 'The server took too long. A model may still be loading — try again in a moment.';
    case 'bad-response':
      return 'The server answered, but not in the OpenAI format Nova expects.';
    case 'aborted':
      return 'Cancelled.';
  }
}
