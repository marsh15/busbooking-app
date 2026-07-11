import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '../lib/api'
import { useAppStore } from '../store'
import { useEffect } from 'react'
import { BusFront, LogOut, Ticket, UserRound } from 'lucide-react'
import { Brand } from './Brand'

export function Layout({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user); const setUser = useAppStore((state) => state.setUser); const setAuthReady = useAppStore((state) => state.setAuthReady); const queryClient = useQueryClient(); const navigate = useNavigate()
  const currentUser = useQuery({ queryKey: ['me'], queryFn: client.me, retry: false })
  useEffect(() => { if (currentUser.data) setUser(currentUser.data.user); if (currentUser.isError) setUser(null); if (currentUser.isFetched) setAuthReady() }, [currentUser.data, currentUser.isError, currentUser.isFetched, setAuthReady, setUser])
  const logout = useMutation({ mutationFn: client.logout, onSuccess: () => { setUser(null); queryClient.clear(); navigate('/') } })
  return <><header className="topbar"><Brand /><nav aria-label="Main navigation"><NavLink to="/"><BusFront /> Find buses</NavLink>{user && <NavLink to="/my-bookings"><Ticket /> My bookings</NavLink>}</nav><div className="account">{user ? <><span className="user-name"><UserRound /> Hi, {user.name.split(' ')[0]}</span><button className="link-button" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut /> Log out</button></> : <><Link to="/login">Log in</Link><Link className="small-cta" to="/register">Create account</Link></>}</div></header>{children}<footer><Brand /><span>Discover. Book. Voyage.</span><small>A simulated booking experience · Prices shown in INR</small></footer></>
}
