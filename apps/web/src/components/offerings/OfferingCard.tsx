import Link from 'next/link';
import { Badge, Money, Sparkline } from '@hack/ui';
import type { MockOffering } from '@/lib/client/mocks/offerings';
import { ArrowUpRight, Users } from 'lucide-react';

export function OfferingCard({ offering }: { offering: MockOffering }) {
  const trendUp = (offering.trend7d.at(-1) ?? 0) >= (offering.trend7d[0] ?? 0);
  return (
    <Link
      href={`/investor/offerings/${offering.id}`}
      className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-5 transition-all hover:border-border-strong hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-lg text-sm font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${offering.thumbnailColor}, ${offering.thumbnailColor}AA)`,
            }}
          >
            {offering.symbol.slice(0, 2)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{offering.name}</h3>
            <p className="text-xs text-foreground-tertiary">
              {offering.issuerOwnerName ?? offering.issuerName} · {offering.symbol}
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-foreground-tertiary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      <p className="mt-4 line-clamp-2 text-xs text-foreground-secondary">{offering.description}</p>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">Precio</p>
          <p className="text-lg font-semibold tabular">
            <Money value={offering.lastTradePrice} currency="USDC" decimals={2} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {offering.expectedAnnualReturn !== undefined && (
            <span className="text-2xs font-semibold tabular text-success-fg">
              {offering.expectedAnnualReturn.toFixed(1)}% APY est.
            </span>
          )}
          <Sparkline
            data={offering.trend7d}
            width={80}
            height={28}
            stroke={trendUp ? '#34D399' : '#F87171'}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <Badge variant={offering.status === 'active' ? 'success' : 'neutral'} size="sm">
          {offering.status === 'active'
            ? 'Activa'
            : offering.status === 'closed'
              ? 'Cerrada'
              : 'Borrador'}
        </Badge>
        <Badge variant="outline" size="sm">
          {offering.sector}
        </Badge>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-foreground-tertiary tabular">
          <Users className="h-3 w-3" />
          {offering.holders}
        </span>
      </div>
    </Link>
  );
}
