'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, MapPin, Pencil, Plus, Search, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import type { Catalog, FixedPriceInput, FixedPriceOffer, OwnFixedPrices, PublicFixedPrice } from '../../../packages/shared/src';
import { api } from './api';

const units: Record<FixedPriceInput['unit'], string> = { service: 'serviço', visit: 'visita', hour: 'hora', day: 'diária' };
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
type Act = (work: () => Promise<void>, reload?: boolean) => Promise<void>;

export function FixedPriceCatalog({ catalog }: { catalog: Catalog }) {
  const [offers, setOffers] = useState<PublicFixedPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => { api<PublicFixedPrice[]>('/fixed-prices').then(setOffers).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  const shown = offers.filter(o => (!category || o.category === category) && normalize(`${o.title} ${o.service} ${o.professionalName}`).includes(normalize(search)));
  return <main className="container fixed-catalog">
    <section className="fixed-hero"><div><p className="eyebrow">ESCOLHA COM O PREÇO EM MÃOS</p><h1>Serviços com<br/><em>preço fechado.</em></h1><p>Conheça os valores publicados por profissionais de Palmas e veja exatamente o que cada oferta inclui.</p><span className="fixed-location"><MapPin size={17}/> Palmas, Tocantins</span></div><div className="fixed-hero-note"><Tag size={34}/><strong>Um serviço. Um valor definido.</strong><p>Confira o escopo e a unidade de atendimento antes de comparar.</p><span><ShieldCheck size={18}/> Profissionais com cadastro aprovado</span></div></section>
    <div className="fixed-filters"><label><Search size={18}/><input aria-label="Buscar preços fixos" placeholder="Busque um serviço ou profissional" value={search} onChange={e => setSearch(e.target.value)}/></label><select aria-label="Categoria dos preços fixos" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{[...new Set(catalog.services.map(s => s.category))].map(c => <option key={c}>{c}</option>)}</select></div>
    {error ? <p role="alert" className="info-box">{error}</p> : loading ? <p role="status">Carregando preços fixos…</p> : <><p className="muted">{shown.length} {shown.length === 1 ? 'oferta disponível' : 'ofertas disponíveis'}</p>{shown.length ? <div className="fixed-grid">{shown.map(o => <article className="fixed-card" key={o.id}><div className="row-between"><span className="badge green">{o.category}</span><Tag size={19}/></div><p className="meta">{o.service}</p><h2>{o.title}</h2><div className="fixed-amount">{money(o.priceCents)}<small>por {units[o.unit]}</small></div><h3>O que está incluído</h3><p className="fixed-description">{o.description}</p><div className="fixed-professional"><span className="avatar">{o.professionalName[0]}</span><div><strong>{o.professionalName}</strong><small>{Number(o.ratingCount) > 0 ? `★ ${Number(o.rating).toFixed(1)} · ${o.ratingCount} avaliações` : 'Cadastro aprovado'}</small></div><Check size={18}/></div></article>)}</div> : <div className="fixed-empty"><Tag size={34}/><h2>{offers.length ? 'Nenhuma oferta para esta busca' : 'Os próximos preços fixos aparecem aqui'}</h2><p>{offers.length ? 'Tente outro serviço ou categoria.' : 'Profissionais podem habilitar o Preço Fechado no painel e publicar seus serviços com valor definido.'}</p></div>}<p className="fixed-footnote">Os valores são definidos pelos profissionais para o escopo descrito. Esta área é um catálogo de consulta; combine disponibilidade e condições antes de contratar.</p></>}
  </main>;
}

export function FixedPricePanel({ catalog, act, notify, busy, profile }: { catalog: Catalog; act: Act; notify: (message: string) => void; busy: boolean; profile: () => void }) {
  const [data, setData] = useState<OwnFixedPrices | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FixedPriceOffer | 'new' | null>(null);
  const [formError, setFormError] = useState('');
  useEffect(() => { api<OwnFixedPrices>('/pro/fixed-prices').then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Carregando suas ofertas…</p>;
  const services = catalog.services.filter(s => data.services.includes(s.id));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError('');
    const form = new FormData(event.currentTarget);
    const price = String(form.get('price')).trim();
    if (!/^\d{1,7}([,.]\d{1,2})?$/.test(price)) { setFormError('Informe um preço válido, como 150,00, sem separador de milhar.'); return; }
    const [whole, fraction = ''] = price.replace(',', '.').split('.');
    const priceCents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (priceCents < 1 || priceCents > 100000000) { setFormError('O preço deve ficar entre R$ 0,01 e R$ 1.000.000,00.'); return; }
    const body = { serviceId: Number(form.get('service')), cityId: 1721000, title: form.get('title'), description: form.get('description'), priceCents, unit: form.get('unit'), active: form.get('active') === 'on' };
    await act(async () => { await api(editing && editing !== 'new' ? `/pro/fixed-prices/${editing.id}` : '/pro/fixed-prices', editing && editing !== 'new' ? 'PATCH' : 'POST', body); notify('Oferta salva.'); });
  }
  const offer = editing && editing !== 'new' ? editing : null;
  return <><div className="panel-heading"><div><p className="eyebrow">SEU TRABALHO, SEU VALOR</p><h1>Meus preços fixos</h1><p className="muted">Publique ofertas com preço e escopo definidos.</p></div><Tag size={32}/></div>
    <div className="fixed-opt-in"><div><strong>Habilitar Preço Fechado</strong><p>Suas ofertas ativas aparecem na aba pública quando seu cadastro e telefone estiverem aprovados.</p></div><button type="button" role="switch" aria-label="Habilitar Preço Fechado" aria-checked={data.enabled} disabled={busy || !data.hasProfile} className={`fixed-switch ${data.enabled ? 'enabled' : ''}`} onClick={() => void act(async () => { await api('/pro/fixed-prices/settings', 'PATCH', { enabled: !data.enabled }); notify(data.enabled ? 'Preço Fechado desabilitado.' : 'Preço Fechado habilitado.'); })}><span/>{data.enabled ? 'Ativado' : 'Desativado'}</button></div>
    {!data.hasProfile || !services.length ? <div className="info-box"><span>Cadastre seu perfil e selecione seus serviços para criar ofertas.</span><button className="text-button" onClick={profile}>Editar perfil <ArrowRight size={16}/></button></div> : <>
      {data.verificationStatus !== 'verified' && <p className="info-box"><ShieldCheck size={18}/>Você pode preparar ofertas. A publicação aguarda aprovação do cadastro e verificação do telefone.</p>}
      {!data.enabled && <p className="muted">A opção está desativada. As ofertas salvas ficam disponíveis somente no seu painel.</p>}
      {!editing && <button className="button" onClick={() => { setFormError(''); setEditing('new'); }}><Plus size={18}/>Criar oferta</button>}
      {editing && <form className="form fixed-editor" key={offer?.id ?? 'new'} onSubmit={save}><h2>{offer ? 'Editar oferta' : 'Nova oferta de preço fechado'}</h2><label>Serviço<select name="service" defaultValue={offer?.serviceId} required>{offer && !services.some(s => s.id === offer.serviceId) && <option value="">Selecione um serviço ativo do seu perfil</option>}{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Nome da oferta<input name="title" defaultValue={offer?.title} minLength={5} maxLength={100} required placeholder="Ex.: Limpeza de apartamento até 60 m²"/></label><label>O que está incluído e quais são os limites?<textarea name="description" defaultValue={offer?.description} minLength={15} maxLength={1200} required rows={4} placeholder="Detalhe atividades, materiais, duração e exclusões. Não inclua contatos."/></label><div className="fixed-price-fields"><label>Preço em reais<input name="price" inputMode="decimal" defaultValue={offer ? (offer.priceCents / 100).toFixed(2).replace('.', ',') : ''} placeholder="150,00" required/></label><label>Valor por<select name="unit" defaultValue={offer?.unit ?? 'service'}>{Object.entries(units).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div><label className="checkbox"><input name="active" type="checkbox" defaultChecked={offer?.active ?? true}/>Oferta ativa</label><p className="muted">Atendimento em Palmas, TO. O preço deve cobrir o escopo descrito.</p>{formError && <p role="alert">{formError}</p>}<div className="inline-form"><button className="button" disabled={busy}>Salvar oferta <Check size={18}/></button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancelar</button></div></form>}
      <div className="fixed-own-list">{data.offers.map(o => <article className="fixed-own-card" key={o.id}><div><span className={`badge ${o.active ? 'green' : ''}`}>{o.active ? 'Ativa' : 'Pausada'}</span><h3>{o.title}</h3><strong>{money(o.priceCents)} / {units[o.unit]}</strong><p>{o.description}</p></div><div className="inline-form"><button className="button outline compact" disabled={busy} onClick={() => { setFormError(''); setEditing(o); }}><Pencil size={15}/>Editar</button><button className="text-button danger" disabled={busy} onClick={() => { if (window.confirm('Excluir esta oferta de preço fixo?')) void act(async () => { await api(`/pro/fixed-prices/${o.id}`, 'DELETE'); notify('Oferta excluída.'); }); }}><Trash2 size={16}/>Excluir</button></div></article>)}{!data.offers.length && !editing && <div className="fixed-empty"><Tag size={30}/><h3>Seu catálogo começa com uma oferta</h3><p>Defina um serviço, descreva o escopo e escolha o valor.</p></div>}</div>
    </>}
  </>;
}
