import { HttpException } from '@nestjs/common';
export function fail(code: string, message: string, status = 400): never { throw new HttpException({ error: { code, message } }, status); }
export function required<T>(value: T | undefined, code = 'NOT_FOUND', message = 'Registro não encontrado.'): T { if (!value) fail(code, message, 404); return value; }
