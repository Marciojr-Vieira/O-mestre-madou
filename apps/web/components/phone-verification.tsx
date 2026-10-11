'use client';
import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, ShieldCheck } from 'lucide-react';
import { api } from './api';
type Act=(work:()=>Promise<void>,reload?:boolean)=>void;
export default function PhoneVerification({verified,act,onVerified}:{verified:boolean;act:Act;onVerified:()=>void}) {
  const [mode,setMode]=useState<'demo'|'manual'|null>(null),[code,setCode]=useState(''),[demoCode,setDemoCode]=useState('');
  const [checking,setChecking]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{api<{phoneVerification:'demo'|'manual'}>('/auth/options').then(options=>setMode(options.phoneVerification)).catch(()=>setMode('manual'));},[]);
  if(verified)return <div className="verified"><BadgeCheck size={17}/>Telefone confirmado</div>;
  if(!mode)return <p className="muted">Conferindo confirmação do telefone…</p>;
  if(mode==='manual')return <div className="verification manual-verification"><Clock size={24}/><div><strong>Telefone aguardando confirmação</strong><p>A administração precisa confirmar seu contato. Seu cadastro já está salvo e você pode editar seus dados. A publicação de pedidos e a liberação de oportunidades dependem dessa confirmação.</p><button type="button" className="button outline compact" disabled={checking} onClick={()=>{setChecking(true);act(async()=>{try{const user=await api<{phoneVerified:boolean}>('/auth/me');if(user.phoneVerified)onVerified();else setMessage('Seu contato ainda aguarda confirmação administrativa.');}finally{setChecking(false);}},false);}}>Conferir confirmação</button>{message&&<p role="status">{message}</p>}</div></div>;
  return <div className="verification"><strong><ShieldCheck size={18}/> Confirme seu telefone</strong><p>Este ambiente utiliza códigos de demonstração, sem enviar SMS.</p><button type="button" className="button outline compact" onClick={()=>act(async()=>{const result=await api<{demoCode?:string}>('/auth/otp','POST');setDemoCode(result.demoCode??'');},false)}>Solicitar código</button>{demoCode&&<p className="demo-note">Código de demonstração: <strong>{demoCode}</strong></p>}<div className="inline-form"><input aria-label="Código de verificação" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Código de 6 dígitos" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))}/><button type="button" className="button compact" disabled={!/^\d{6}$/.test(code)} onClick={()=>act(async()=>{await api('/auth/otp/verify','POST',{code});onVerified();},false)}>Verificar</button></div></div>;
}
