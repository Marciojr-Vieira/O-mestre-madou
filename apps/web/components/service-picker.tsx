'use client';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Service } from '../../../packages/shared/src';

export default function ServicePicker({catalog,selected,onChange}:{catalog:Service[];selected:number[];onChange:(ids:number[])=>void}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState('');
  const categories=[...new Set(catalog.map(service=>service.category))];
  const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const filtered=catalog.filter(service=>(!category||service.category===category)&&normalize(`${service.name} ${service.category}`).includes(normalize(query)));
  function toggle(id:number){onChange(selected.includes(id)?selected.filter(value=>value!==id):[...selected,id]);}
  return <fieldset className="service-picker"><legend>Profissões e serviços <span>{selected.length} selecionados</span></legend><p className="muted">Selecione os serviços que você realiza. As opções vêm do catálogo disponível na plataforma.</p><div className="service-picker-filters"><label><span className="sr-only">Buscar profissão ou serviço</span><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar profissão ou serviço"/></label><label><span className="sr-only">Categoria dos serviços</span><select value={category} onChange={event=>setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(name=><option key={name}>{name}</option>)}</select></label></div>{selected.length>0&&<div className="selected-services">{selected.map(id=>{const service=catalog.find(item=>item.id===id);return <button key={id} type="button" onClick={()=>toggle(id)} aria-label={`Remover ${service?.name??'serviço indisponível'}`}>{service?.name??'Serviço indisponível'}<X size={13}/></button>;})}</div>}<div className="service-picker-list">{filtered.map(service=><label key={service.id} className={selected.includes(service.id)?'selected':''}><input type="checkbox" checked={selected.includes(service.id)} onChange={()=>toggle(service.id)}/><span>{service.name}<small>{service.category}</small></span></label>)}{!filtered.length&&<p role="status">Nenhum serviço encontrado. Tente outro termo ou categoria.</p>}</div><small>{filtered.length} serviços disponíveis no filtro. A seleção é mantida ao trocar de categoria.</small></fieldset>;
}
