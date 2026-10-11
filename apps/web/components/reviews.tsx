'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
type Review={id:number;rating:number;comment:string;pro_reply:string|null;created_at:string};
export default function ProfessionalReviews({notify}:{notify:(message:string)=>void}){
  const [reviews,setReviews]=useState<Review[]>([]);const [error,setError]=useState('');
  useEffect(()=>{api<Review[]>('/pro/reviews').then(setReviews).catch(e=>setError(e.message));},[]);
  async function reply(e:FormEvent<HTMLFormElement>,id:number){e.preventDefault();const data=new FormData(e.currentTarget);try{await api(`/reviews/${id}/reply`,'POST',{reply:data.get('reply')});const refreshed=await api<Review[]>('/pro/reviews');setReviews(refreshed);notify('Resposta publicada.');}catch(e){setError(e instanceof Error?e.message:'Falha ao responder.');}}
  return <section className="margin-top"><h3>Suas avaliações publicadas</h3>{error&&<p role="alert">{error}</p>}{!reviews.length&&<p className="muted">Suas avaliações aparecerão aqui após a moderação. Você poderá responder a cada uma.</p>}{reviews.map(r=><article className="admin-card" key={r.id}><span className="teal">{'★'.repeat(r.rating)}</span><p>{r.comment}</p>{r.pro_reply&&<p className="info-box">Sua resposta: {r.pro_reply}</p>}<form className="inline-form" onSubmit={e=>reply(e,r.id)}><input aria-label="Resposta à avaliação" name="reply" placeholder="Agradeça e responda à avaliação" minLength={5} maxLength={600} required defaultValue={r.pro_reply||''}/><button className="button outline compact">Responder</button></form></article>)}</section>;
}
