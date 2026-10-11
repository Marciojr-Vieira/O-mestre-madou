'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { Account, Catalog, User } from '../../../packages/shared/src';
import { api } from './api';
import PhoneVerification from './phone-verification';
type Act=(work:()=>Promise<void>,reload?:boolean)=>void;
export default function AccountPanel({catalog,act,notify,updated}:{catalog:Catalog;act:Act;notify:(message:string)=>void;updated:(user:User)=>void}) {
  const [account,setAccount]=useState<Account|null>(null),[error,setError]=useState('');
  useEffect(()=>{api<Account>('/auth/profile').then(setAccount).catch(cause=>setError(cause.message));},[]);
  if(error)return <p role="alert" className="auth-error">{error}</p>;
  if(!account)return <p>Carregando seus dados…</p>;
  async function reload(){const value=await api<Account>('/auth/profile');setAccount(value);updated(value);}
  return <><div className="panel-heading"><div><h1>Minha conta</h1><p className="muted">Confira seus dados e acompanhe a confirmação do cadastro.</p></div></div><PhoneVerification verified={account.phoneVerified} act={act} onVerified={()=>{void reload();notify('Telefone confirmado.');}}/><form className="form account-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);act(async()=>{const saved=await api<Account>('/auth/profile','PATCH',{name:data.get('name'),cityId:Number(data.get('cityId')),neighborhood:data.get('neighborhood')});setAccount(saved);updated(saved);notify('Dados da conta atualizados.');},false);}}><label>Nome completo<input name="name" required minLength={3} maxLength={100} autoComplete="name" defaultValue={account.name}/></label><div className="registration-columns"><label>E-mail<input type="email" value={account.email} readOnly autoComplete="email"/></label><label>Celular<input type="tel" value={account.phone} readOnly autoComplete="tel"/></label></div><label>Cidade<select name="cityId" defaultValue={String(account.cityId??catalog.cities[0]?.id??'')} required>{catalog.cities.map(city=><option key={city.id} value={city.id}>{city.name}, TO</option>)}</select></label><label>Bairro <small>(opcional)</small><input name="neighborhood" maxLength={100} autoComplete="address-level3" defaultValue={account.neighborhood}/></label><button className="button">Salvar meus dados <Check size={17}/></button></form></>;
}
