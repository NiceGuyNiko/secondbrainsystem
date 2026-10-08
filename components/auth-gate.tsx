'use client';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
export default function AuthGate({children}:{children:React.ReactNode}) {
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const [mode,setMode]=useState<'login'|'register'|'reset'>('login');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [username,setUsername]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false)}});return()=>{active=false;subscription.unsubscribe()}},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');
  try {
   if(mode==='register'){if(!/^[a-z0-9_]{3,24}$/.test(username)){setMessage('Username: 3–24 lowercase letters, numbers or underscores.');return}
    const {error}=await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:window.location.origin}});if(error)throw error;setMessage('Check your email for a confirmation link. Then sign in.');}
   else if(mode==='reset'){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)throw error;setMessage('If this address has an account, a reset email has been sent.');}
   else {const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
  }catch(err){setMessage(err instanceof Error?err.message:'Something went wrong.')}finally{setBusy(false)}
 }
 if(loading)return <main className="grid min-h-screen place-items-center text-slate-300">Loading your workspace…</main>;
 if(session)return <><div className="fixed right-3 top-2 z-50 flex items-center gap-2 rounded-lg bg-slate-900/95 px-3 py-2 text-xs shadow"><span className="max-w-32 truncate text-slate-300">{session.user.email}</span><button className="font-semibold text-teal-300" onClick={()=>supabase.auth.signOut()}>Sign out</button></div>{children}</>;
 return <main className="flex min-h-screen items-center justify-center p-5"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151e30] p-7"><h1 className="text-2xl font-bold">Think About It<span className="text-teal-400">.</span></h1><p className="mt-2 text-sm text-slate-400">{mode==='login'?'Sign in to your private workspace':mode==='register'?'Create your private account':'Reset your password'}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode==='register'&&<label className="block text-sm">Username<input required minLength={3} maxLength={24} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} className="mt-1 w-full rounded-lg bg-slate-800 p-3" placeholder="your_username"/></label>}<label className="block text-sm">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-3" placeholder="you@example.com"/></label>{mode!=='reset'&&<label className="block text-sm">Password<span className="relative mt-1 block"><input required type={showPassword?"text":"password"} minLength={6} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-lg bg-slate-800 p-3 pr-12"/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-3 text-slate-400">{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></span></label>}<button disabled={busy} className="w-full rounded-lg bg-teal-400 p-3 font-semibold text-slate-950 disabled:opacity-50">{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Create account':'Send reset email'}</button></form>{message&&<p role="status" className="mt-4 text-sm text-teal-200">{message}</p>}<div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-400">{mode!=='login'&&<button onClick={()=>{setMode('login');setMessage('')}}>Sign in</button>}{mode!=='register'&&<button onClick={()=>{setMode('register');setMessage('')}}>Create account</button>}{mode!=='reset'&&<button onClick={()=>{setMode('reset');setMessage('')}}>Forgot password?</button>}</div></div></main>;
}
