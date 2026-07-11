import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/api'
import { useAppStore } from '../store'
import { useEffect } from 'react'
import { BusFront, LogOut, Menu, Moon, Sun, Ticket, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Logo } from './Logo'

export function Layout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('voyage-theme') === 'dark')
  const user = useAppStore((state) => state.user); const setUser = useAppStore((state) => state.setUser); const setAuthReady = useAppStore((state) => state.setAuthReady); const queryClient = useQueryClient(); const navigate = useNavigate()
  const currentUser = useQuery({ queryKey: ['me'], queryFn: client.me, retry: false })
  useEffect(() => { if (currentUser.data) setUser(currentUser.data.user); if (currentUser.isError) setUser(null); if (currentUser.isFetched) setAuthReady() }, [currentUser.data, currentUser.isError, currentUser.isFetched, setAuthReady, setUser])
  const logout = useMutation({ mutationFn: client.logout, onSuccess: () => { setUser(null); queryClient.clear(); navigate('/') } })
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('voyage-theme', dark ? 'dark' : 'light') }, [dark])
  return <><header className="topbar"><Logo /><nav aria-label="Main navigation"><NavLink to="/"><BusFront /> Find buses</NavLink>{user && <NavLink to="/my-bookings"><Ticket /> My bookings</NavLink>}</nav><div className="account"><button className="icon-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</button>{user ? <><span className="user-name"><UserRound /> Hi, {user.name.split(' ')[0]}</span><button className="link-button" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut /> Log out</button></> : <><Link to="/login">Log in</Link><Link className="small-cta" to="/register">Create account</Link></>}<button className="mobile-menu icon-button" aria-label="Open menu"><Menu /></button></div></header>{children}<footer><Logo /><p>Discover. Book. Voyage.</p><span>© 2026 VoyageBus · A simulated portfolio booking experience</span></footer></>
}
