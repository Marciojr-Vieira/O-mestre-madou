import type { Metadata } from 'next';
import MarketplaceApp from '../../components/marketplace';
export const metadata: Metadata = { title: 'Preço Fechado em Palmas | O Mestre Mandou', description: 'Consulte serviços com preço fixo publicados por profissionais de Palmas, Tocantins.' };
export default function Page() { return <MarketplaceApp initialView="fixed-prices"/>; }
