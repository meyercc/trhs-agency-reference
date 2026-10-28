import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Input, Toggle, ToggleButtonGroup } from '../components';
import { useNova, type DemoSpeed } from '../state/Nova';
import { explain, isLocalEndpoint, probe, type ProbeResult } from './llm';
import { RATES_AS_OF } from './models';
import { recipeDemos, useRecipeDemoResets } from '../agents/recipes';

const SPEEDS: { label: string; value: DemoSpeed }[] = [
  { label: '1× (compressed)', value: 'compressed' },
  { label: '2×', value: 'fast' },
  { label: 'Instant', value: 'instant' },
];

/**
 * Nova's own settings: the optional local model, demo speed, reset. The
 * tokenomics assumptions join in TH-431.
 *
 * The local model is OFF until someone turns it on, and the endpoint has to
 * be on this machine — Nova never sends a conversation off it. "Test
 * connection" really asks the server, and its failure copy says what the
 * browser is likely refusing and why (Ollama's OLLAMA_ORIGINS is the usual
 * answer), because an unreachable model must read as a thing to fix, not a
 * broken page.
 */
export function NovaSettingsPopover() {
  const { settings, setSetting, resetDemo } = useNova();
  const demoResets = useRecipeDemoResets();
  const navigate = useNavigate();
  const [test, setTest] = useState<ProbeResult | 'testing' | null>(null);
  const listId = useId();
  const localOk = isLocalEndpoint(settings.endpoint);
  const models = test && test !== 'testing' && test.ok ? test.models : [];

  const runTest = async () => {
    setTest('testing');
    setTest(await probe(settings.endpoint));
  };

  return (
    <div className="nova-pop-body">
      <h3 className="nova-pop-title">Nova settings</h3>

      <div className="nova-pop-row">
        <span className="nova-pop-label">Optional local model</span>
        <label className="nova-pop-toggle">
          <Toggle checked={settings.llmEnabled} onChange={(on) => setSetting('llmEnabled', on)} aria-label="Send unmatched questions to a local model" />
          <span>Send unmatched questions to a local model</span>
        </label>
        <Input
          aria-label="OpenAI-compatible or Ollama endpoint (localhost only)"
          placeholder="http://localhost:11434/v1/chat/completions"
          value={settings.endpoint}
          onChange={(e) => setSetting('endpoint', e.target.value)}
          error={settings.endpoint && !localOk ? 'Must be on this machine (localhost).' : undefined}
          spellCheck={false}
        />
        <Input
          aria-label="Model name"
          placeholder="Model name"
          value={settings.model}
          onChange={(e) => setSetting('model', e.target.value)}
          list={listId}
          spellCheck={false}
        />
        <datalist id={listId}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="nova-pop-test">
          <Button size="sm" onClick={runTest} disabled={!localOk || test === 'testing'}>
            {test === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          {test && test !== 'testing' && (
            <span className="nova-pop-test-result" role="status">
              {test.ok ? (
                <>
                  <Badge variant="status" tone="positive">
                    Connected
                  </Badge>
                  <span className="nova-pop-note">
                    {test.models.length ? `${test.models.length} model${test.models.length === 1 ? '' : 's'}` : 'no models listed'} · {test.ms} ms
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="status" tone="warn">
                    Not reachable
                  </Badge>
                  <span className="nova-pop-note">{explain(test.kind)}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="nova-pop-row">
        <span className="nova-pop-label">Demo speed</span>
        <ToggleButtonGroup
          aria-label="Demo speed"
          options={SPEEDS}
          value={settings.demoSpeed}
          onChange={(v) => setSetting('demoSpeed', v as DemoSpeed)}
          fullWidth
        />
        <p className="nova-pop-note">How quickly scripted replies arrive. Instant is for walking a reviewer through the log.</p>
      </div>

      <div className="nova-pop-row">
        <span className="nova-pop-label">Tokenomics assumptions</span>
        <label className="nova-pop-field">
          <span>Cloud rate, $ per 1M tokens (blended)</span>
          <Input
            variant="numeric"
            inputMode="decimal"
            aria-label="Assumed cloud rate, dollars per million tokens"
            value={String(settings.cloudRatePerM)}
            onChange={(e) => setSetting('cloudRatePerM', Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="nova-pop-field">
          <span>Local draw while answering, watts</span>
          <Input
            variant="numeric"
            inputMode="numeric"
            aria-label="Assumed local draw in watts"
            value={String(settings.localWatts)}
            onChange={(e) => setSetting('localWatts', Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <p className="nova-pop-note">What a local reply would have cost in the cloud, and what it drew here. Vendor rates in the model list as of {RATES_AS_OF}.</p>
      </div>

      <div className="nova-pop-row">
        <Button size="sm" onClick={resetDemo}>
          Reset demo state
        </Button>
        <p className="nova-pop-note">Clears your conversations, usage and these settings. The seeded history stays.</p>
      </div>

      {/* Each Nova recipe's demo start position — also `#/?demo=<id>` (agents/recipes.tsx). */}
      {recipeDemos().map((d) => (
        <div className="nova-pop-row" key={d.id}>
          <Button
            size="sm"
            onClick={() => {
              demoResets[d.id]();
              navigate(d.landing);
            }}
          >
            {d.label}
          </Button>
          <p className="nova-pop-note">{d.note}</p>
        </div>
      ))}
    </div>
  );
}
