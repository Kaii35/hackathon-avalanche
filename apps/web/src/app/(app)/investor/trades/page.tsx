'use client';

import { Badge, EmptyState, PageHeader } from '@hack/ui';
import { Sparkles } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { FujiActivityTable } from '@/components/wallet/FujiActivityTable';

export default function TradesPage() {
  const { address, realConnected } = useWallet();

  if (!realConnected || !address) {
    return (
      <>
        <PageHeader
          title="Mis trades"
          description="Conecta tu wallet para ver los trades reales asociados a tu dirección."
        />
        <ConnectWalletPrompt
          title="Conecta tu wallet para ver tus trades"
          description="El historial de trades se asocia a la wallet que firmó cada operación. Conecta una para verlos."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mis trades"
        description="Trades reales asociados a tu wallet. No mostramos datos de demostración."
        meta={
          <Badge variant="outline" className="font-mono text-2xs">
            {address.slice(0, 6)}…{address.slice(-4)}
          </Badge>
        }
      />

      {/* Sección 1: trades IFC (todavía no existen) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Trades IFC</h2>
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Aún no hay trades IFC para esta wallet"
          description="Los trades de participaciones IFC aparecerán aquí cuando los smart contracts ERC-3643 estén deployados en Fuji y operes con ellos. Mientras tanto, mira tu actividad on-chain real abajo."
        />
      </section>

      {/* Sección 2: actividad on-chain real */}
      <section className="mt-8 space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Actividad on-chain en Fuji
        </h2>
        <FujiActivityTable
          wallet={address}
          title="Tus transacciones reales en Avalanche Fuji"
          helper="Datos en vivo del explorer público — AVAX y ERC-20 transfers. Click en cualquier tx para verla en Snowtrace."
        />
      </section>
    </>
  );
}
