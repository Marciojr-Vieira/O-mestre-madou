import { createServer } from 'node:net';

export async function assertPortAvailable(port: number) {
  if (port === 0) return;
  for(const host of ['127.0.0.1','::1']) {
    try {
      await new Promise<void>((resolve,reject)=>{
        const server=createServer();server.once('error',reject);
        server.listen(port,host,()=>server.close(error=>error?reject(error):resolve()));
      });
    }catch(error){
      const code=typeof error==='object' && error!==null && 'code' in error?String(error.code):'';
      if(host==='::1' && ['EAFNOSUPPORT','EADDRNOTAVAIL'].includes(code))continue;
      throw error;
    }
  }
}

export function startupMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'EADDRINUSE') return 'Porta ocupada. Encerre a instância anterior do Elo antes de iniciar novamente.';
  if (code === 'DATABASE_LOCKED') return 'Banco local em uso por outra instância. Encerre a API anterior antes de iniciar novamente.';
  if (code === 'ECONNREFUSED') return 'PostgreSQL indisponível. Inicie o banco e confira DATABASE_MODE e DATABASE_URL no .env.';
  if (['ENETUNREACH','EHOSTUNREACH','ENOTFOUND','ETIMEDOUT'].includes(code) || (error instanceof Error && error.message.includes('Connection terminated due to connection timeout'))) return 'Conexão PostgreSQL indisponível. Na Supabase, use a URI do Session pooler para redes IPv4 e confira host/porta no .env.';
  if (code === '28P01') return 'Autenticação no PostgreSQL recusada. Confira as credenciais de DATABASE_URL no .env.';
  if (code === 'MIGRATIONS_PENDING') return 'Existem migrations pendentes. Execute make.ps1 db-migrate com a credencial de migração antes de iniciar a API.';
  if (code === 'API_START_TIMEOUT') return 'A API não ficou pronta em três minutos. Confira a conexão PostgreSQL e a inicialização dos dados de demonstração.';
  if (code === 'DATABASE_ROLE_UNSAFE') return 'O papel restrito da API não foi aplicado na conexão PostgreSQL. Confira DATABASE_RUNTIME_ROLE e suas permissões.';
  if (['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'].includes(code)) return 'Certificado PostgreSQL não validado. Configure DATABASE_CA_FILE com o certificado oficial; mantenha a verificação TLS ativada.';
  if (code === 'EACCES' || code === 'EPERM') return 'Sem permissão para abrir o banco local. Confira DATA_DIR e as permissões da pasta.';
  if (error instanceof Error && error.message.includes('Aborted')) return 'Banco embarcado não pôde abrir: possível WAL/checkpoint inválido após interrupção. Preserve DATA_DIR e consulte README.md para recuperação. Nenhum dado foi apagado.';
  return `Falha na inicialização (${/^[A-Z0-9_]{1,20}$/.test(code) ? code : 'INTERNAL'}). Confira a configuração do banco e as migrations; nenhum dado foi apagado.`;
}
