
import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentBadge, nonProductionLabel } from '@/components/environment';
export const metadata: Metadata = { title: nonProductionLabel ? `[${nonProductionLabel}] All About Action` : 'All About Action', description: 'Connected information. Contextual action.', icons: {icon:'/icon.png',apple:'/apple-icon.png'} };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{__html:`try{var m=localStorage.getItem('think-theme')||'dark';document.documentElement.dataset.theme=m==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):m;var t=JSON.parse(localStorage.getItem('aaa-resolved-theme-v1')||'null');if(t&&t.mode===document.documentElement.dataset.theme)for(var k in t.tokens)if(/^--ui-[a-z-]+$/.test(k)&&typeof t.tokens[k]==='string')document.documentElement.style.setProperty(k,t.tokens[k]);}catch(e){}`}}/><EnvironmentBadge/>{children}</body></html>; }
