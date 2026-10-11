'use client';
import { useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { api } from './api';
type Profile={name:string;bio:string;rating_avg:number;rating_count:number;verification_status:string;reviews:{rating:number;comment:string;pro_reply:string|null}[]};
export default function PublicProfile({id,name}:{id:number;name:string}){
  const [profile,setProfile]=useState<Profile|null>(null);const [error,setError]=useState('');
  return <><button className="profile-name" onClick={()=>{setError('');api<Profile>(`/professionals/${id}`).then(setProfile).catch(e=>setError(e.message));}}>{name}</button>{error&&<small role="alert">{error}</small>}{profile&&<div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setProfile(null);}}><section className="modal" role="dialog" aria-modal="true" aria-label={profile.name}><div className="modal-header"><h2>{profile.name}</h2><button className="icon-button" aria-label="Fechar perfil" onClick={()=>setProfile(null)}><X/></button></div>{profile.verification_status==='verified'&&<p className="verified"><BadgeCheck size={18}/>Cadastro aprovado</p>}<p>{profile.bio}</p><p>{Number(profile.rating_count)>0?`★ ${Number(profile.rating_avg).toFixed(1)} · ${profile.rating_count} avaliações publicadas`:'Ainda sem avaliações publicadas.'}</p>{profile.reviews.map((r,i)=><article className="admin-card" key={i}><strong className="teal">{'★'.repeat(r.rating)}</strong><p>{r.comment}</p>{r.pro_reply&&<p className="info-box">Resposta do profissional: {r.pro_reply}</p>}</article>)}</section></div>}</>;
}
