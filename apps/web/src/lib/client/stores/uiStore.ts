'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  /** Wallet connect/link dialog (in app shell) — opened manually from Topbar. */
  walletDialogOpen: boolean;
  setWalletDialogOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),
      walletDialogOpen: false,
      setWalletDialogOpen: (v) => set({ walletDialogOpen: v }),
    }),
    { name: 'ifc-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
