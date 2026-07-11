import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { client } from '../lib/api'
import { useAppStore } from '../store'
import { Brand } from '../components/Brand'

const loginSchema = z.object({ email: z.string().email('Enter a valid email address.'), password: z.string().min(8, 'Use at least 8 characters.') })
const registerSchema = loginSchema.extend({ name: z.string().min(2, 'Tell us what to call you.') })
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'; const schema = isRegister ? registerSchema : loginSchema; const navigate = useNavigate(); const location = useLocation(); const setUser = useAppStore((state) => state.setUser); const queryClient = useQueryClient()
  type AuthValues = z.infer<typeof registerSchema>
  const form = useForm<AuthValues>({ resolver: zodResolver(schema) as unknown as Resolver<AuthValues>, defaultValues: { name: '', email: '', password: '' } })
  const mutation = useMutation({ mutationFn: (values: AuthValues) => isRegister ? client.register(values) : client.login(values), onSuccess: (result) => { setUser(result.user); queryClient.setQueryData(['me'], result); navigate((location.state as { from?: string } | null)?.from || '/', { replace: true }) } })
  return <main className="auth-page"><section className="auth-aside"><Brand light /><div><p className="eyebrow light">GOOD TO SEE YOU</p><h1>Small details make the journey feel considered.</h1><p>Save tickets, make multi-seat bookings, and cancel a single ticket when plans shift.</p></div></section><section className="auth-card"><div><p className="eyebrow">{isRegister ? 'JOIN VOYAGEBUS' : 'WELCOME BACK'}</p><h1>{isRegister ? 'Create your account' : 'Log in to your trips'}</h1><p className="muted">{isRegister ? 'Your next journey is just a few taps away.' : 'Use the demo account: demo@smartbus.in / SmartBus123!'}</p></div><form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>{isRegister && <Field label="Your name" error={form.formState.errors.name?.message}><input {...form.register('name')} autoComplete="name" /></Field>}<Field label="Email address" error={form.formState.errors.email?.message}><input {...form.register('email')} type="email" autoComplete="email" /></Field><Field label="Password" error={form.formState.errors.password?.message}><input {...form.register('password')} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} /></Field>{mutation.isError && <p className="form-error">{(mutation.error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'We could not sign you in. Try again.'}</p>}<button className="primary wide" disabled={mutation.isPending}>{mutation.isPending ? 'Just a moment…' : isRegister ? 'Create account' : 'Log in'}</button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to VoyageBus?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create one'}</Link></p></section></main>
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}{error && <small className="form-error">{error}</small>}</label> }
