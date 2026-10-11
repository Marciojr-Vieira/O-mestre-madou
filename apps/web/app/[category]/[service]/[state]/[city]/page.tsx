import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketplaceApp from '../../../../../components/marketplace';
import catalog from '../../../../../../../packages/shared/src/catalog.json';
import {siteConfig} from '../../../../../lib/site';
type Params={category:string;service:string;state:string;city:string};
export function generateStaticParams(){return catalog.map(s=>({category:s.categorySlug,service:s.slug,state:'to',city:'palmas'}));}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{const p=await params;const service=catalog.find(s=>s.slug===p.service&&s.categorySlug===p.category);if(!service)notFound();return {title:`${service.name} em Palmas, TO — O Mestre Mandou`,description:`Solicite gratuitamente ${service.name.toLowerCase()} em Palmas e receba contato de até quatro profissionais. Negocie diretamente.`,alternates:{canonical:`${siteConfig.APP_URL}/${p.category}/${p.service}/to/palmas`}};}
export default async function ServicePage({params}:{params:Promise<Params>}){const p=await params;const service=catalog.find(s=>s.slug===p.service&&s.categorySlug===p.category);if(!service||p.state!=='to'||p.city!=='palmas')notFound();const structured={'@context':'https://schema.org','@type':'Service',name:service.name,serviceType:service.name,areaServed:{'@type':'City',name:'Palmas',containedInPlace:{'@type':'State',name:'Tocantins'}},provider:{'@type':'Organization',name:'O Mestre Mandou'}};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/><MarketplaceApp initialService={p.service} initialServiceName={service.name} initialCategory={p.category}/></>;}
