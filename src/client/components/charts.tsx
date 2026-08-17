/**
 * Charts.
 *
 * Colors are CSS custom properties, so light and dark use the palette steps
 * chosen and validated for each surface rather than an automatic flip. Series
 * slots are assigned in fixed order and never cycled: a ninth category folds
 * into "Other" instead of inventing a hue.
 */
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { money, moneyShort, monthLabel } from '../lib/format.ts';
import type { MonthlyCashFlow, PortfolioPoint, AllocationSlice } from '@shared/types.ts';

const SERIES = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
] as const;

const axis = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  axisLine: { stroke: 'var(--axis)' },
  tickLine: false,
} as const;

function Empty({ label }: { label: string }) {
  return <div className="state">{label}</div>;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className="swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

interface TipPayload {
  active?: boolean;
  label?: string | number;
  payload?: { name: string; value: number; color?: string; fill?: string }[];
}

function MoneyTooltip({ active, label, payload }: TipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="t-label">{monthLabel(String(label))}</div>
      {payload.map((entry) => (
        <div className="t-row" key={entry.name}>
          <span>
            <i
              className="swatch"
              style={{ background: entry.color ?? entry.fill, marginRight: 6 }}
            />
            {entry.name}
          </span>
          <span>{money(Math.abs(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

/** Chart 1 — cumulative capital deployed, returned and still outstanding. */
export function PortfolioTrend({ data }: { data: PortfolioPoint[] }) {
  if (data.length < 2) return <Empty label="Not enough history yet" />;

  const series = [
    { key: 'invested', label: 'Invested', color: SERIES[0] },
    { key: 'returned', label: 'Returned', color: SERIES[1] },
    { key: 'outstanding', label: 'Outstanding', color: SERIES[2] },
  ];

  return (
    <>
      <div className="chart-frame">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} minTickGap={40} />
            <YAxis tickFormatter={moneyShort} width={52} {...axis} />
            <Tooltip content={<MoneyTooltip />} cursor={{ stroke: 'var(--axis)' }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

/**
 * Chart 2 — cash flow as polarity, not two categories: money in rises above
 * the baseline, money out falls below it, so net direction reads at a glance.
 */
export function CashFlowChart({ data }: { data: MonthlyCashFlow[] }) {
  if (!data.length) return <Empty label="No cash flow recorded yet" />;

  const rows = data.map((d) => ({ month: d.month, In: d.inflow, Out: -d.outflow }));

  return (
    <>
      <div className="chart-frame">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} minTickGap={40} />
            <YAxis tickFormatter={moneyShort} width={52} {...axis} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--plane)' }} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Bar dataKey="In" fill="var(--pos)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Out" fill="var(--neg)" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[
        { label: 'Money in', color: 'var(--pos)' },
        { label: 'Money out', color: 'var(--neg)' },
      ]} />
    </>
  );
}

/** Chart 4 — profit received per month, coloured by sign. */
export function MonthlyProfitChart({ data }: { data: MonthlyCashFlow[] }) {
  if (!data.length) return <Empty label="No profit recorded yet" />;

  return (
    <div className="chart-frame">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} minTickGap={40} />
          <YAxis tickFormatter={moneyShort} width={52} {...axis} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--plane)' }} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.profit < 0 ? 'var(--neg)' : 'var(--pos)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Chart 3 — part-to-whole as one stacked bar rather than a donut: shares are
 * far easier to compare along a common baseline. Every segment carries a
 * visible value and share, which is also the relief for the three light-mode
 * slots that fall below 3:1 against the surface.
 */
export function AllocationBar({ data }: { data: AllocationSlice[] }) {
  if (!data.length) return <Empty label="No capital outstanding" />;

  // Fixed slot order, never cycled: a ninth industry folds into "Other".
  const visible = data.slice(0, 7);
  const rest = data.slice(7);
  const slices = rest.length
    ? [...visible, { label: 'Other', value: rest.reduce((sum, r) => sum + r.value, 0) }]
    : visible;

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      <div className="stack">
        {slices.map((slice, i) => (
          <div
            key={slice.label}
            title={`${slice.label}: ${money(slice.value)}`}
            style={{
              background: SERIES[i % SERIES.length],
              flexGrow: slice.value,
              flexBasis: 0,
            }}
          />
        ))}
      </div>
      <div className="alloc-list">
        {slices.map((slice, i) => (
          <div key={slice.label}>
            <i className="swatch" style={{ background: SERIES[i % SERIES.length] }} />
            <span>{slice.label}</span>
            <span className="share">{((slice.value / total) * 100).toFixed(1)}%</span>
            <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {money(slice.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
