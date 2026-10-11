import type { Metadata } from 'next';
import { siteConfig } from '../lib/site';
import './globals.css';
import './redesign.css';
import './fixed-prices.css';
import './master.css';
export const metadata: Metadata = {
  metadataBase:new URL(siteConfig.APP_URL),
  title:'O Mestre Mandou — Você pede. Um mestre resolve.',
  applicationName:'O Mestre Mandou',
  description:'Encontre profissionais em Palmas, Tocantins. Conte o que precisa, receba até quatro contatos e negocie diretamente. Solicite seu orçamento gratuitamente.',
  openGraph:{title:'O Mestre Mandou',siteName:'O Mestre Mandou',locale:'pt_BR',type:'website',description:'Você pede. Um mestre resolve. Encontre profissionais em Palmas, Tocantins.'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body>{children}</body></html>;}
