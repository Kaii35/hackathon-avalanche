import type { AuditLogEntryDto } from '@hack/shared';

export interface MockInvestor {
  id: string;
  fullName: string;
  email: string;
  wallet: `0x${string}`;
  kycStatus: 'pending' | 'verified' | 'rejected';
  jurisdiction: number;
  jurisdictionLabel: string;
  accredited: boolean;
  frozen: boolean;
  joinedAt: string;
  totalInvested: number;
}

const NAMES = [
  'María Hernández',
  'Luis Ramírez',
  'Carlos Mendoza',
  'Sofía Torres',
  'Andrea López',
  'Diego Vargas',
  'Patricia Ruiz',
  'José Morales',
  'Valeria Castillo',
  'Ricardo Salazar',
  'Mónica Aguirre',
  'Fernando Cervantes',
  'Lucía Beltrán',
  'Juan Pablo Solís',
  'Karla Rojas',
  'Emiliano Galindo',
  'Alejandra Núñez',
  'Hugo Esquivel',
  'Daniela Iglesias',
  'Roberto Quintero',
];

export const MOCK_INVESTORS: MockInvestor[] = NAMES.map((name, i) => ({
  id: `inv-${i.toString().padStart(3, '0')}`,
  fullName: name,
  email: `${name
    .toLowerCase()
    .split(' ')
    .join('.')
    .replace(/[áéíóúñ]/g, (c) => 'aeioun'['áéíóúñ'.indexOf(c)] ?? c)}@arkangeles.test`,
  wallet: `0x${(i + 1).toString(16).padStart(40, '0')}` as `0x${string}`,
  kycStatus: i % 7 === 0 ? 'pending' : i % 11 === 0 ? 'rejected' : 'verified',
  jurisdiction: i % 5 === 0 ? 840 : i % 9 === 0 ? 724 : 484,
  jurisdictionLabel: i % 5 === 0 ? 'Estados Unidos' : i % 9 === 0 ? 'España' : 'México',
  accredited: i % 3 === 0,
  frozen: i === 13,
  joinedAt: new Date(Date.now() - i * 86400_000 * 7).toISOString(),
  totalInvested: 50000 + i * 28500 + Math.floor(Math.random() * 25000),
}));

export const MOCK_AUDIT_LOG: AuditLogEntryDto[] = [
  {
    id: 'al-001',
    action: 'wallet_frozen',
    actor: 'admin@arkangeles.mx',
    target: '0x000000000000000000000000000000000000000d',
    payload: { reason: 'Orden judicial 12345/2026 - Juzgado 4º Civil', regulator: 'CNBV' },
    txHash: '0xfreeze000000000000000000000000000000000000000000000000000000001',
    createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
  },
  {
    id: 'al-002',
    action: 'kyc_verified',
    actor: 'system',
    target: '0x0000000000000000000000000000000000000005',
    payload: { jurisdiction: 484, accredited: true },
    txHash: '0xverify00000000000000000000000000000000000000000000000000000002',
    createdAt: new Date(Date.now() - 3600_000 * 12).toISOString(),
  },
  {
    id: 'al-003',
    action: 'forced_transfer',
    actor: 'compliance@arkangeles.mx',
    target: '0x0000000000000000000000000000000000000003',
    payload: {
      from: '0x0000000000000000000000000000000000000003',
      to: '0x0000000000000000000000000000000000000007',
      qty: '850',
      reason: 'Recovery por pérdida de claves verificada con identificación oficial.',
    },
    txHash: '0xforced00000000000000000000000000000000000000000000000000000003',
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
  },
  {
    id: 'al-004',
    action: 'whitelist_add',
    actor: 'admin@arkangeles.mx',
    target: '0x0000000000000000000000000000000000000011',
    payload: { jurisdiction: 484, accredited: false },
    txHash: '0xwhite000000000000000000000000000000000000000000000000000000004',
    createdAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
  {
    id: 'al-005',
    action: 'offering_deployed',
    actor: 'issuer@cosechaverde.com',
    target: '0x4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
    payload: { name: 'Agro-Renovables MX', symbol: 'CVAGRO', supply: '20000000' },
    txHash: '0xdeploy00000000000000000000000000000000000000000000000000000005',
    createdAt: new Date(Date.now() - 86400_000 * 5).toISOString(),
  },
];
