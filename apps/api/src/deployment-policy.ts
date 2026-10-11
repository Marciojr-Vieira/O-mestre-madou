type DeploymentConfig = {
  DATABASE_MODE: 'embedded' | 'postgres';
  DATABASE_URL?: string;
  DATABASE_SCHEMA: string;
  DATABASE_MIGRATE: 'true' | 'false';
  DEMO_MODE: 'true' | 'false';
  JWT_SECRET?: string;
};

export function assertHostedConfiguration(config: DeploymentConfig) {
  if (config.DATABASE_MODE !== 'postgres' || !config.DATABASE_URL || !config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    throw new Error('Hospedagem exige PostgreSQL e um segredo JWT de pelo menos 32 caracteres.');
  }
  if (config.DEMO_MODE === 'true' && !config.DATABASE_SCHEMA.endsWith('_demo')) {
    throw new Error('Demonstração hospedada exige um schema separado com sufixo _demo.');
  }
}

export function assertNetlifyConfiguration(config: DeploymentConfig) {
  assertHostedConfiguration(config);
  if (config.DATABASE_MIGRATE !== 'false') {
    throw new Error('Netlify exige migrations previamente aplicadas e DATABASE_MIGRATE=false.');
  }
}
