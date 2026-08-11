import { create } from 'zustand'
import type { User } from './types'

interface AppState {
  user: User | null
  authReady: boolean
  selectedTripId: string | null
  selectedSeats: string[]
  setUser: (user: User | null) => void
  setAuthReady: () => void
  setTripSelection: (tripId: string, seats: string[]) => void
  clearTripSelection: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authReady: false,
  selectedTripId: null,
  selectedSeats: [],
  setUser: (user) => set({ user }),
  setAuthReady: () => set({ authReady: true }),
  setTripSelection: (selectedTripId, selectedSeats) => set({ selectedTripId, selectedSeats }),
  clearTripSelection: () => set({ selectedTripId: null, selectedSeats: [] }),
}))
