import { create } from 'zustand'
import type { User } from './types'

interface AppState { user: User | null; setUser: (user: User | null) => void; selectedSeats: string[]; setSelectedSeats: (seats: string[]) => void }
export const useAppStore = create<AppState>((set) => ({ user: null, selectedSeats: [], setUser: (user) => set({ user }), setSelectedSeats: (selectedSeats) => set({ selectedSeats }) }))
