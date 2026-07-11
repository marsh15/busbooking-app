import { create } from 'zustand'
import type { User } from './types'

interface AppState { user: User | null; authReady: boolean; setUser: (user: User | null) => void; setAuthReady: () => void; selectedSeats: string[]; setSelectedSeats: (seats: string[]) => void }
export const useAppStore = create<AppState>((set) => ({ user: null, authReady: false, selectedSeats: [], setUser: (user) => set({ user }), setAuthReady: () => set({ authReady: true }), setSelectedSeats: (selectedSeats) => set({ selectedSeats }) }))
