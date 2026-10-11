import { z } from 'zod';
export const siteConfig=z.object({APP_URL:z.string().url().default('http://localhost:3000')}).parse(process.env);
