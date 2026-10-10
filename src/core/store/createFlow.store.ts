import { create } from 'zustand';

// Mirrors CreateTab's own step state (1 | 2) so app/(app)/index.tsx's
// swipe-direction block can tell "fresh, nothing entered yet" apart from
// "mid-form" — swiping away is only risky once there's actually a half-filled
// form to lose.
interface CreateFlowState {
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
}

export const useCreateFlowStore = create<CreateFlowState>((set) => ({
  step: 1,
  setStep: (step) => set({ step }),
}));
