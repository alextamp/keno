import { create } from 'zustand';
import { EventEntity } from '../../domain/entities/event.entity';

interface EventsState {
  events: EventEntity[];
  selectedEvent: EventEntity | null;
  isLoading: boolean;
  error: string | null;

  setEvents: (events: EventEntity[]) => void;
  upsertEvent: (event: EventEntity) => void;
  removeEvent: (id: string) => void;
  setSelectedEvent: (event: EventEntity | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  selectedEvent: null,
  isLoading: false,
  error: null,

  setEvents: (events) => set({ events }),

  upsertEvent: (event) =>
    set((state) => {
      const exists = state.events.some((e) => e.id === event.id);
      return {
        events: exists
          ? state.events.map((e) => (e.id === event.id ? event : e))
          : [event, ...state.events],
      };
    }),

  removeEvent: (id) =>
    set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
