import { StatTile } from '../components';
import { useNova } from '../state/Nova';
import { LOCAL_MODEL_ID, MODEL_BY_ID, RATES_AS_OF, rateLabel } from './models';
import { fmtTokens, fmtUsd, fmtWh } from './format';

/**
 * What the conversation has cost, live. Three totals — the cloud-equivalent
 * cost, the local energy, the share of cloud cost avoided — then the rows:
 * input context, generated response, and the rate the comparison assumes.
 *
 * Every figure is from the ledger, recorded at the moment of each reply, so
 * changing an assumption in settings moves the next reply, not the history.
 * The footnote says so, and says when the vendor rates were read.
 */
/**
 * The three totals as tiles — the popover's head, and a composed card's
 * tokenomics block (TH-450). One component so both say the same numbers from
 * the same ledger; `compact` is the card's size, where the tiles flow 2-up
 * beside the readings.
 */
export function TokenomicsTiles({ compact, ...rest }: { compact?: boolean } & Record<`data-${string}`, string>) {
  const { totals } = useNova();
  const estimatedAny = totals.tokensIn + totals.tokensOut > 0;
  const avoided = Math.round(totals.costAvoidedPct * 100);
  return (
    <>
      <StatTile compact={compact} label="Cloud cost" value={fmtUsd(totals.cloudCostUsd)} delta={compact ? undefined : 'equivalent'} data-key="cost" {...rest} />
      <StatTile compact={compact} label="Local energy" value={fmtWh(totals.localWh).replace(/ .*$/, '')} unit={fmtWh(totals.localWh).replace(/^[\d.]+ /, '')} tone="neutral" data-key="energy" {...rest} />
      <StatTile compact={compact} label="Cost avoided" value={estimatedAny ? String(avoided) : '—'} unit={estimatedAny ? '%' : undefined} tone="positive" data-key="avoided" {...rest} />
    </>
  );
}

export function TokenomicsPopover() {
  const { totals, settings, modelId } = useNova();
  const model = MODEL_BY_ID[modelId];

  return (
    <div className="nova-pop-body">
      <h3 className="nova-pop-title">Tokenomics</h3>
      <div className="nova-tok-tiles">
        <TokenomicsTiles />
      </div>
      <dl className="nova-tok-rows">
        <div className="nova-tok-row" data-key="in">
          <dt>Input context</dt>
          <dd>
            <span className="nova-tok-num">{fmtTokens(totals.tokensIn)}</span> tokens
          </dd>
        </div>
        <div className="nova-tok-row" data-key="out">
          <dt>Generated response</dt>
          <dd>
            <span className="nova-tok-num">{fmtTokens(totals.tokensOut)}</span> tokens
          </dd>
        </div>
        <div className="nova-tok-row" data-key="rate">
          <dt>Assumed cloud rate</dt>
          <dd>
            {model ? (
              <>
                <span className="nova-tok-num">{model.label}</span> · {rateLabel(model)}
              </>
            ) : (
              <>
                <span className="nova-tok-num">${settings.cloudRatePerM}</span> per 1M, blended
              </>
            )}
          </dd>
        </div>
        <div className="nova-tok-row" data-key="watts">
          <dt>Assumed local draw</dt>
          <dd>
            <span className="nova-tok-num">{settings.localWatts}</span> W while answering
          </dd>
        </div>
      </dl>
      <p className="nova-pop-note">
        Totals since the last reset, recorded at each reply — changing an assumption applies to the next one.
        {modelId === LOCAL_MODEL_ID ? ' Cloud cost is what these replies would have cost at the assumed rate.' : ` Replies are priced as ${model?.label}.`}{' '}
        Vendor rates as of {RATES_AS_OF}.
      </p>
    </div>
  );
}
