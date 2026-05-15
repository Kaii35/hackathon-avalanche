'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@hack/ui';

const faqs = [
  {
    q: '¿Los tokens son valores bursátiles?',
    a: 'No. Son representación digital de participaciones de IFCs reguladas bajo la Ley Fintech. El matiz importa: están fuera del régimen de la Ley del Mercado de Valores y son operables entre inversionistas calificados.',
  },
  {
    q: '¿Cómo se cumple el límite de holders por oferta?',
    a: 'El módulo MaxHoldersModule bloquea a nivel de smart contract toda transferencia que rebase el cupo de inversionistas calificados que cada oferta tiene configurado por reglamento.',
  },
  {
    q: '¿Qué pasa si pierdo mis claves?',
    a: 'La IFC puede ejecutar un forced transfer hacia una wallet nueva tras validar identidad. La operación queda inmutable en el audit log y emite un evento on-chain.',
  },
  {
    q: '¿Quién opera el matching engine?',
    a: 'Arkangeles (o la IFC operadora). El matching es off-chain por costo y velocidad, pero las firmas son EIP-712, así que el matcher no puede falsificar órdenes — solo cruzarlas.',
  },
  {
    q: '¿Por qué Avalanche y no Ethereum?',
    a: 'Subnet propia con validadores controlados por la IFC, gas pagable en stablecoin, transacciones permissioned a nivel de protocolo y throughput ajustado al volumen regulado.',
  },
  {
    q: '¿Tengo que tener wallet para invertir?',
    a: 'Sí. El onboarding incluye conexión de wallet con un mensaje SIWE para vincularla a tu cuenta verificada. La wallet queda registrada en IdentityRegistry tras el claim de KYC.',
  },
  {
    q: '¿Hay custodia centralizada?',
    a: 'No. Settlement se ejecuta atomicamente vía smart contract: tokens A→B y USDC B→A en una sola transacción. Si compliance falla, todo revierte. Nadie pierde nada.',
  },
  {
    q: '¿Cómo se cobra el fee de plataforma?',
    a: 'Configurable por oferta vía bps (por default 50 bps = 0.5%). Se descuenta del USDC del comprador en cada settlement y se manda a la wallet de la IFC.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container max-w-3xl">
        <div className="mb-10">
          <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">Preguntas</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Lo que los inversionistas y CFOs preguntan.
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="text-foreground-secondary">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
