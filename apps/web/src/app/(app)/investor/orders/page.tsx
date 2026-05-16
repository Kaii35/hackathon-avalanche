'use client';

import { Badge, EmptyState, PageHeader } from '@hack/ui';
import { ListChecks } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { FujiActivityTable } from '@/components/wallet/FujiActivityTable';

export default function MyOrdersPage() {
  const { address, realConnected } = useWallet();

  if (!realConnected || !address) {
    return (
      <>
        <PageHeader
          title="Mis órdenes"
          description="Conecta tu wallet para ver las órdenes reales asociadas a tu dirección."
        />
        <ConnectWalletPrompt
          title="Conecta tu wallet para ver tus órdenes"
          description="Las órdenes IFC viven asociadas a una wallet. Conecta una y sólo verás las tuyas."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mis órdenes"
        description="Órdenes reales asociadas a tu wallet. No mostramos datos de demostración."
        meta={
          <Badge variant="outline" className="font-mono text-2xs">
            {address.slice(0, 6)}…{address.slice(-4)}
          </Badge>
        }
      />

      {/* Sección 1: órdenes IFC (todavía no existen) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Órdenes IFC</h2>
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title="Aún no hay órdenes IFC para esta wallet"
          description="Las órdenes EIP-712 firmadas aparecerán aquí cuando los smart contracts ERC-3643 estén deployados y crees una orden en el orderbook. Mientras tanto, mira tu actividad on-chain real abajo."
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
          helper="Datos en vivo del explorer público. Cuando crees y ejecutes órdenes IFC, aparecerán aquí también."
        />
      </section>
    </>
  );
}
