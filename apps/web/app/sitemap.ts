import type { MetadataRoute } from 'next';
import catalog from '../../../packages/shared/src/catalog.json';
import {siteConfig} from '../lib/site';
export default function sitemap():MetadataRoute.Sitemap{return [{url:siteConfig.APP_URL,changeFrequency:'weekly',priority:1},...catalog.map(s=>({url:`${siteConfig.APP_URL}/${s.categorySlug}/${s.slug}/to/palmas`,changeFrequency:'monthly' as const,priority:0.7}))];}
