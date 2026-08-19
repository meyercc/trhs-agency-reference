import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Chip, Input, Button, Icon, type StatusTone } from '../components';
import { allSkus, deviceImageUrl, heroImageFile, type Sku, type Colorway } from '../devices/skus';
import './registry.css';

/**
 * SKU Registry — the React home of configurator/registry.html: every entry in
 * skus.json as a browsable card grid with type/status filters and search.
 * Preview opens the real device modal over this page (`?sku=`); Edit jumps to
 * the configurator (canvas types only — the long tail still edits in vanilla).
 */

const CANVAS_TYPES = new Set(['mouse', 'keyboard', 'headset', 'monitor', 'microphone']);

const STATUS_TONE: Record<string, StatusTone> = {
  shipping: 'positive',
  engineering: 'warn',
  'in-design': 'info',
  eol: 'danger',
};

function defaultColorway(sku: Sku): Colorway | undefined {
  const cws = sku.colorways || [];
  return cws.find((c) => c.default) || cws[0];
}

function RegistryCard({ sku }: { sku: Sku }) {
  const [cw, setCw] = useState<Colorway | undefined>(defaultColorway(sku));
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const art = deviceImageUrl(cw?.image) ?? deviceImageUrl(heroImageFile(sku));
  const editable = CANVAS_TYPES.has(sku.type);
  const figma = Array.isArray(sku.links?.figma) ? sku.links!.figma : [];

  return (
    <article className="reg-card">
      <div className="reg-card-art">{art ? <img src={art} alt={sku.name} loading="lazy" /> : <Icon name="devices" size={28} />}</div>
      <div className="reg-card-body">
        <div className="reg-card-head">
          <span className="reg-card-name">{sku.name}</span>
          <Badge variant="status" tone={STATUS_TONE[sku.status ?? ''] ?? 'info'}>
            {sku.status ?? 'unknown'}
          </Badge>
        </div>
        <div className="reg-card-meta">
          <span className="reg-card-type">{sku.type}</span>
          {sku.codenames?.length ? <span className="reg-card-code">{sku.codenames.join(' · ')}</span> : null}
        </div>
        {(sku.colorways?.length ?? 0) > 1 && (
          <div className="reg-card-cws" role="radiogroup" aria-label="Colorway">
            {sku.colorways!.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={cw?.id === c.id}
                aria-label={c.label || c.id}
                title={c.label || c.id}
                className={'reg-cw-dot' + (cw?.id === c.id ? ' active' : '')}
                data-cw={c.id}
                onClick={() => setCw(c)}
              />
            ))}
          </div>
        )}
        <div className="reg-card-foot">
          <div className="reg-card-links">
            {figma.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" title={f.title || 'Figma'}>
                <Icon name="shortcut" size={13} /> {f.title || 'Figma'}
              </a>
            ))}
            {sku.links?.swpd && !/^PERIPH/.test(sku.links.swpd) && (
              <a href={sku.links.swpd} target="_blank" rel="noopener noreferrer">
                <Icon name="shortcut" size={13} /> SWPD
              </a>
            )}
          </div>
          <div className="reg-card-btns">
            <Button size="sm" onClick={() => setParams({ sku: sku.id })}>
              Preview
            </Button>
            <Button
              size="sm"
              variant="accent"
              disabled={!editable}
              title={editable ? undefined : 'This type still edits in the vanilla configurator'}
              onClick={() => navigate(`/configurator?edit=${sku.id}`)}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Registry() {
  const navigate = useNavigate();
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');

  const types = useMemo(() => ['all', ...Array.from(new Set(allSkus.map((s) => s.type)))], []);
  const skus = useMemo(
    () =>
      allSkus.filter(
        (s) =>
          (type === 'all' || s.type === type) &&
          (!q ||
            [s.name, s.id, ...(s.codenames ?? [])].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
      ),
    [type, q],
  );

  return (
    <div>
      <div className="reg-title-row">
        <div>
          <h1 className="ds-text-title-1 page-title">SKU Registry</h1>
          <p className="ds-text-body page-sub">
            {allSkus.length} products in the registry — preview any of them live, or spec a new one.
          </p>
        </div>
        <Button variant="accent" onClick={() => navigate('/configurator')}>
          <Icon name="add" size={16} /> Spec a new SKU
        </Button>
      </div>

      <div className="reg-filters">
        <div className="reg-chips" role="radiogroup" aria-label="Filter by type">
          {types.map((t) => (
            <Chip key={t} selected={type === t} onClick={() => setType(t)}>
              {t}
            </Chip>
          ))}
        </div>
        <Input
          variant="search"
          placeholder="Search name, id, codename"
          aria-label="Search SKUs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="reg-grid">
        {skus.map((s) => (
          <RegistryCard key={s.id} sku={s} />
        ))}
        {skus.length === 0 && <p className="reg-empty">No SKUs match.</p>}
      </div>
    </div>
  );
}
