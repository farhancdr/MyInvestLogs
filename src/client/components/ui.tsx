import { useEffect, type ReactNode } from 'react';
import { money, percent, tone } from '../lib/format.ts';

export function Panel({
  title, hint, children,
}: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {hint && <span className="hint">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label, value, note, valueTone,
}: { label: string; value: string; note?: string; valueTone?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${valueTone ?? ''}`}>{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const cls = value === 'Active' ? 'on' : value === 'Defaulted' ? 'off' : '';
  return <span className={`badge ${cls}`}>{value}</span>;
}

export function SummaryItem({
  label, value, valueTone,
}: { label: string; value: string; valueTone?: string }) {
  return (
    <div className="item">
      <div className="k">{label}</div>
      <div className={`v ${valueTone ?? ''}`}>{value}</div>
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <div className="k">{label}</div>
      <div>{value}</div>
    </div>
  );
}

export function MoneyCell({ value }: { value: number | null }) {
  return <span className={tone(value)}>{money(value)}</span>;
}

export function PercentCell({ value }: { value: number | null }) {
  return <span className={tone(value)}>{percent(value)}</span>;
}

export function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label, children, hint,
}: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Select({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | { value: string; label: string }[];
  placeholder?: string;
}) {
  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="notice error">{message}</div>;
}
