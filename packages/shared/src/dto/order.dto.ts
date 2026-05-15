import { z } from 'zod';
import { ORDER_SIDES } from '../constants';

const decimalString = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Número decimal inválido');
const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección inválida')
  .transform((v) => v.toLowerCase() as `0x${string}`);
const signatureSchema = z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Firma inválida');

export const CreateOrderSchema = z.object({
  offeringId: z.string().uuid('Oferta inválida'),
  maker: addressSchema,
  side: z.enum(ORDER_SIDES),
  qty: decimalString,
  price: decimalString,
  expiresAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha de expiración inválida'),
  salt: z.string().regex(/^\d+$/, 'Salt inválido'),
  signature: signatureSchema,
});
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export const CancelOrderParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface OrderResponseDto {
  id: string;
  orderHash: `0x${string}`;
  offeringId: string;
  maker: `0x${string}`;
  side: 'buy' | 'sell';
  qty: string;
  price: string;
  filledQty: string;
  status: 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface BookLevelDto {
  price: string;
  qty: string;
  orderCount: number;
}

export interface OrderbookResponseDto {
  offeringId: string;
  bids: BookLevelDto[];
  asks: BookLevelDto[];
  lastTradePrice: string | null;
  updatedAt: string;
}
