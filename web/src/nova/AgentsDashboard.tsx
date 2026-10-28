import { useSearchParams } from 'react-router-dom';
import { Button, Icon, ListBox, ListItem, StatTile, Tooltip } from '../components';
import { TrendGraph } from '../widgets/perform7/TrendGraph';
import { ForgeContent, ForgeNav, useForge } from '../forge/ForgeBody';
import type { ForgeListing } from '../forge/types';
import { AGENT_BY_ID } from '../agents/registry';
import { useAgents } from '../state/Agents';
import { useNova, type ActivityItem } from '../state/Nova';
import { fmtTokens, relTime, startOfToday } from './format';

const DAY = 86_400_000;

/** "Mon" … "Today" for the seven columns, oldest first. */
function dayLabels(now = Date.now()): string[] {
  const today = startOfToday(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = today - (6 - i) * DAY;
    return i === 6 ? 'Today' : i === 5 ? 'Yest.' : new Date(d).toLocaleDateString('en-US', { weekday: 'short' });
  });
}

const ACTIVITY_ICON: Record<ActivityItem['kind'], 'message' | 'bolt' | 'add' | 'minus'> = {
  run: 'message',
  action: 'bolt',
  'agent-added': 'add',
  'agent-removed': 'minus',
};

/**
 * The Agents view: what the agents have done, then the catalog itself.
 *
 * Four tiles read the same seven-day ledger the chart draws, so the numbers
 * and the picture agree. The chart is the Perform page's TrendGraph — a
 * declared domain, the peak marked — wrapped in an HTML layer of seven day
 * cells that carry the labels and a focusable readout per day (values are
 * never hover-only). One series, so no legend: the title names it.
 *
 * The store is Forge's own body, inline — same nav, same cards, same detail
 * page — with each agent's card carrying its usage line here.
 */
export function AgentsDashboard() {
  const { addedCount, has } = useAgents();
  const { byDay7, totals, ledger, activity } = useNova();
  const [, setParams] = useSearchParams();
  const forge = useForge();

  const today = byDay7[6];
  const data = byDay7.map((d) => Math.round(d.tokens / 100) / 10); // thousands, one decimal
  const peak = Math.max(...data, 1);
  const max = Math.max(10, Math.ceil(peak / 10) * 10);
  const labels = dayLabels();
  const avoided = totals.cloudCostUsd > 0 ? `${Math.round(totals.costAvoidedPct * 100)}` : '—';
  const usageOf = (l: ForgeListing) => (l.agentId ? ledger.byAgent[l.agentId] : undefined);

  const openModal = () =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'agents');
      return p;
    });

  return (
    <div className="nova-agents" role="tabpanel" aria-label="Agents">
      <div className="nova-dash">
        <div className="nova-dash-tiles">
          <StatTile icon="ai" label="Agents added" value={String(addedCount)} tone="neutral" data-key="added" />
          <StatTile icon="message" label="Runs today" value={String(today?.runs ?? 0)} data-key="runs" />
          <StatTile icon="tokens" label="Tokens today" value={fmtTokens(today?.tokens ?? 0)} data-key="tokens" />
          <StatTile icon="bolt" label="Cost avoided" value={avoided} unit={avoided === '—' ? undefined : '%'} tone="positive" delta="since reset" data-key="avoided" />
        </div>

        <div className="nova-dash-row">
          <section className="nova-dash-card nova-chart" aria-label="Tokens per day, last seven days">
            <h3 className="nova-rail-title">Tokens per day</h3>
            <div className="nova-chart-plot">
              <TrendGraph data={data} max={max} unit="k" window="Last 7 days" />
              {/* The readout per day: a focusable cell over each column, labelled
                  for assistive tech and tooltipped for pointers. */}
              <div className="nova-chart-cells" aria-hidden={false}>
                {byDay7.map((d, i) => (
                  <Tooltip key={d.day} content={`${labels[i]} · ${fmtTokens(d.tokens)} tokens · ${d.runs} run${d.runs === 1 ? '' : 's'}`} placement="top">
                    <div className="nova-chart-cell" tabIndex={0} aria-label={`${labels[i]}: ${fmtTokens(d.tokens)} tokens, ${d.runs} runs`} />
                  </Tooltip>
                ))}
              </div>
            </div>
            <div className="nova-chart-days" aria-hidden="true">
              {labels.map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
          </section>

          <section className="nova-dash-card nova-activity" aria-label="Recent activity">
            <h3 className="nova-rail-title">Recent activity</h3>
            {activity.length === 0 ? (
              <p className="nova-pop-note">Nothing yet — ask Nova something, or route a prompt through an agent.</p>
            ) : (
              <ListBox role="list" className="nova-activity-list" maxHeight="var(--nv-activity-max-h)">
                {activity.slice(0, 20).map((a) => (
                  <ListItem
                    key={a.id}
                    role="listitem"
                    tabIndex={-1}
                    leading={<Icon name={a.agentId ? AGENT_BY_ID[a.agentId]?.icon ?? ACTIVITY_ICON[a.kind] : ACTIVITY_ICON[a.kind]} size="sm" />}
                    label={a.text}
                    trailing={<span className="nova-activity-when">{relTime(a.at)}</span>}
                  />
                ))}
              </ListBox>
            )}
          </section>
        </div>
      </div>

      <div className="nova-dash-head">
        <h2 className="nova-rail-title">Forge</h2>
        <Button size="sm" variant="ghost" onClick={openModal}>
          Open Forge
        </Button>
      </div>
      <section className="forge-inline" aria-label="Forge">
        <div className="forge-inline-left">
          <ForgeNav state={forge} />
        </div>
        <div className="forge-inline-right">
          <ForgeContent state={forge} usageOf={(l) => (has(l.id) || usageOf(l) ? usageOf(l) : undefined)} />
        </div>
      </section>
    </div>
  );
}
