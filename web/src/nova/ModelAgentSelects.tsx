import { Dropdown, type DropdownGroup, type DropdownOption } from '../components';
import { AGENT_BY_ID } from '../agents/registry';
import { useAgents } from '../state/Agents';
import { useNova } from '../state/Nova';
import { LOCAL_MODEL_ID, MODELS_BY_VENDOR } from './models';

const NO_AGENT = 'nova';

/**
 * Who answers and on what: the model and the agent. One component, so the two
 * places it lives can never offer different lists — the top of the Treehouse
 * context rail on the full page (Chris, 2026-10-20), and the pinned panel's
 * composer, which has no rail to hold it.
 *
 * `openUp` for a composer at the bottom of a column; the rail opens down.
 */
export function ModelAgentSelects({ openUp = false, className }: { openUp?: boolean; className?: string }) {
  const { settings, modelId, setModelId, agentId, setAgentId } = useNova();
  const { added } = useAgents();

  // The local model answers; a vendor row prices the same reply at that
  // vendor's published rate, for the comparison in Tokenomics.
  const modelGroups: DropdownGroup[] = [
    { label: 'On this machine', options: [{ label: `${settings.model} (local)`, value: LOCAL_MODEL_ID }] },
    ...MODELS_BY_VENDOR.map((g) => ({ label: g.vendor, options: g.models.map((m) => ({ label: m.label, value: m.id })) })),
  ];
  const agentOptions: DropdownOption[] = [
    { label: 'Nova', value: NO_AGENT, icon: 'twinkle' },
    // Only the agents among what you added from Forge — a recipe or an app is
    // something Nova uses, not someone you address.
    ...added.filter((id) => AGENT_BY_ID[id]).map((id) => ({ label: AGENT_BY_ID[id].name, value: id, icon: AGENT_BY_ID[id].icon })),
  ];

  return (
    <div className={['nova-composer-selects', className].filter(Boolean).join(' ')}>
      <Dropdown aria-label="AI model" groups={modelGroups} value={modelId} onChange={setModelId} openUp={openUp} />
      <Dropdown aria-label="Agent" options={agentOptions} value={agentId ?? NO_AGENT} onChange={(v) => setAgentId(v === NO_AGENT ? null : v)} openUp={openUp} />
    </div>
  );
}
