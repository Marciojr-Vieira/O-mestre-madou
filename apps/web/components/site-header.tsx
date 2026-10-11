'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bell, ChevronDown, ClipboardList, Grid2X2, Info, MapPin, Menu, Search, Sparkles, Tag, UsersRound, X } from 'lucide-react';
import Brand from './brand';
import type { Catalog, Service, User } from '../../../packages/shared/src';

export type NavigationTab = 'budgets' | 'fixed-prices' | 'categories' | 'how' | 'professionals';
type Props = {
  catalog: Catalog;
  user: User | null;
  activeTab: NavigationTab;
  unread: boolean;
  navigate: (tab: NavigationTab) => void;
  selectCategory: (name: string) => void;
  request: (service: Service) => void;
  login: () => void;
  registerProfessional: () => void;
  account: () => void;
  notifications: () => void;
  logout: () => void;
};

const tabs: { id: NavigationTab; label: string; icon: typeof Search }[] = [
  { id: 'budgets', label: 'Orçamentos', icon: ClipboardList },
  { id: 'fixed-prices', label: 'Preço Fechado', icon: Tag },
  { id: 'categories', label: 'Categorias', icon: Grid2X2 },
  { id: 'how', label: 'Como funciona', icon: Info },
  { id: 'professionals', label: 'Para profissionais', icon: UsersRound },
];
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function SiteHeader(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const root = useRef<HTMLElement>(null);
  const categories = [...new Set(props.catalog.services.map(service => service.category))];
  const currentCategory = categories.includes(category) ? category : categories[0];
  const services = props.catalog.services.filter(service =>
    (search ? true : service.category === currentCategory) &&
    normalizeSearch(service.name).includes(normalizeSearch(search)),
  );

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) { setMenuOpen(false); setMobileOpen(false); }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && (menuOpen || mobileOpen)) {
        setMenuOpen(false); setMobileOpen(false);
        root.current?.querySelector<HTMLButtonElement>('[data-category-trigger]')?.focus();
      }
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [menuOpen, mobileOpen]);

  function navigate(tab: NavigationTab) {
    if (tab === 'categories') { setMenuOpen(!menuOpen); setMobileOpen(false); return; }
    setMenuOpen(false); setMobileOpen(false); props.navigate(tab);
  }

  return <header className="site-header" ref={root}>
    <div className="container header-main">
      <button className="brand" onClick={() => navigate('budgets')} aria-label="O Mestre Mandou, início"><Brand/></button>
      <div className="header-location"><MapPin size={17}/><div><small>ENCONTRE PERTO DE VOCÊ</small><strong>Palmas, Tocantins</strong></div></div>
      <div className="header-actions">
        {props.user ? <>
          <button className="icon-button" aria-label="Notificações" onClick={props.notifications}><Bell size={20}/>{props.unread && <i/>}</button>
          <button className="account-button" onClick={props.account}><span className="avatar small">{props.user.name[0]}</span><span>Minha conta</span><ChevronDown size={14}/></button>
          <button className="text-button logout" onClick={props.logout}>Sair</button>
        </> : <>
          <button className="text-button header-login" onClick={props.login}>Entrar</button>
          <button className="button compact professional-action" onClick={props.registerProfessional}>Seja um profissional <ArrowUpRight size={16}/></button>
        </>}
        <button className="icon-button mobile-nav-toggle" aria-label={mobileOpen ? 'Fechar navegação' : 'Abrir navegação'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => { setMobileOpen(!mobileOpen); setMenuOpen(false); }}>{mobileOpen ? <X/> : <Menu/>}</button>
      </div>
    </div>
    <div className="header-tabs-bar"><div className="container header-tabs-wrap">
      <nav className="header-tabs" aria-label="Navegação principal">{tabs.map(tab => <button key={tab.id} className={`header-tab ${(menuOpen ? tab.id === 'categories' : props.activeTab === tab.id) ? 'active' : ''}`} onClick={() => navigate(tab.id)} {...(tab.id === 'categories' ? { 'aria-expanded': menuOpen, 'aria-controls': 'category-mega-menu', 'data-category-trigger': true } : { 'aria-current': props.activeTab === tab.id ? 'page' as const : undefined })}><tab.icon size={17} strokeWidth={1.6} aria-hidden="true"/>{tab.label}{tab.id === 'categories' && <ChevronDown size={14} className={menuOpen ? 'rotated' : ''}/>}</button>)}</nav>
      <span className="header-promise"><Sparkles size={14}/>Seu pedido é grátis</span>
    </div></div>
    {mobileOpen && <nav className="mobile-navigation" id="mobile-navigation" aria-label="Navegação no celular">{tabs.map(tab => <button key={tab.id} onClick={() => navigate(tab.id)}>{tab.label}<ArrowRight size={17}/></button>)}</nav>}
    {menuOpen && <section className="mega-menu container" id="category-mega-menu" aria-label="Explorar categorias de serviços">
      <div className="mega-menu-top"><div><p className="eyebrow">ENCONTRE QUEM SABE FAZER</p><h2>Uma solução para cada plano.</h2></div><label className="mega-search"><Search size={18}/><input autoFocus aria-label="Buscar serviço no menu" placeholder="Qual serviço você procura?" value={search} onChange={event => setSearch(event.target.value)}/></label><button className="icon-button" aria-label="Fechar categorias" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <div className="mega-menu-content"><nav className="mega-categories" aria-label="Categorias">{categories.map(name => <button key={name} className={name === currentCategory && !search ? 'active' : ''} onClick={() => { setCategory(name); setSearch(''); }}>{name}<ArrowRight size={14}/></button>)}</nav>
        <div className="mega-services"><span className="mega-label">{search ? `${services.length} serviços encontrados` : currentCategory}</span><div className="mega-service-grid">{services.map(service => <button key={service.id} onClick={() => { setMenuOpen(false); props.request(service); }}>{service.name}<ArrowUpRight size={14}/></button>)}</div>{!services.length && <p className="muted">Nenhum serviço encontrado. Tente outro termo.</p>}<button className="mega-all" onClick={() => { setMenuOpen(false); props.selectCategory(search ? 'Todas' : currentCategory); }}>Explorar {search ? 'todos os serviços' : 'esta categoria'}<ArrowRight size={17}/></button></div>
      </div>
    </section>}
  </header>;
}
