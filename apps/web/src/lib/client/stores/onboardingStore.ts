'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  step: number;
  fullName: string;
  rfc: string;
  curp: string;
  dateOfBirth: string;
  jurisdiction: number;
  accredited: boolean;
  documentUploaded: boolean;
  proofUploaded: boolean;
  walletConnected: boolean;
  walletAddress: string | null;
  setStep: (s: number) => void;
  patch: (input: Partial<OnboardingState>) => void;
  reset: () => void;
}

const initial: Pick<
  OnboardingState,
  | 'step'
  | 'fullName'
  | 'rfc'
  | 'curp'
  | 'dateOfBirth'
  | 'jurisdiction'
  | 'accredited'
  | 'documentUploaded'
  | 'proofUploaded'
  | 'walletConnected'
  | 'walletAddress'
> = {
  step: 0,
  fullName: '',
  rfc: '',
  curp: '',
  dateOfBirth: '',
  jurisdiction: 484,
  accredited: false,
  documentUploaded: false,
  proofUploaded: false,
  walletConnected: false,
  walletAddress: null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (s) => set({ step: s }),
      patch: (input) => set((state) => ({ ...state, ...input })),
      reset: () => set(initial),
    }),
    { name: 'ifc-onboarding' },
  ),
);
