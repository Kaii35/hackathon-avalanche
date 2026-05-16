export const queryKeys = {
  offerings: {
    all: ['offerings'] as const,
    list: (filters?: Record<string, unknown>) => ['offerings', 'list', filters ?? {}] as const,
    detail: (id: string) => ['offerings', 'detail', id] as const,
    capTable: (id: string) => ['offerings', 'capTable', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    book: (offeringId: string) => ['orders', 'book', offeringId] as const,
    mine: (wallet: string, status?: string) => ['orders', 'mine', wallet, status ?? 'all'] as const,
  },
  trades: {
    all: ['trades'] as const,
    mine: (wallet: string) => ['trades', 'mine', wallet] as const,
    byOffering: (offeringId: string) => ['trades', 'offering', offeringId] as const,
  },
  portfolio: {
    by: (wallet: string) => ['portfolio', wallet] as const,
    history: (wallet: string) => ['portfolio', 'history', wallet] as const,
  },
  activity: {
    me: () => ['activity', 'me'] as const,
  },
  admin: {
    investors: ['admin', 'investors'] as const,
    audit: ['admin', 'audit'] as const,
    invites: ['admin', 'invites'] as const,
  },
  session: {
    me: ['session', 'me'] as const,
  },
};
