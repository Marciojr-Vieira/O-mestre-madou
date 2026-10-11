import { z } from 'zod';

export const normalizePhone = (value:string) => {
  const digits=value.replace(/\D/g,'');
  return `+${digits.startsWith('55')&&digits.length>=12?digits:`55${digits}`}`;
};
export const normalizeDocument = (value:string) => value.replace(/[\s./-]/g,'').toUpperCase();
export function validDocument(value:string) {
  const document=normalizeDocument(value);
  if(/^(.)\1+$/.test(document))return false;
  if(/^\d{11}$/.test(document)){
    for(const length of [9,10]){
      const sum=[...document.slice(0,length)].reduce((total,digit,index)=>total+Number(digit)*(length+1-index),0);
      if(Number(document[length])!==(sum*10%11)%10)return false;
    }
    return true;
  }
  if(!/^[A-Z0-9]{12}\d{2}$/.test(document))return false;
  for(const length of [12,13]){
    const sum=[...document.slice(0,length)].reduce((total,character,index)=>total+(character.charCodeAt(0)-48)*((length-1-index)%8+2),0);
    const remainder=sum%11;
    if(Number(document[length])!==(remainder<2?0:11-remainder))return false;
  }
  return true;
}
export const documentSchema=z.string().transform(normalizeDocument).refine(validDocument,'Informe um CPF ou CNPJ válido.');
export const serviceProfileSchema=z.object({
  document:documentSchema,
  bio:z.string().trim().min(15,'Conte um pouco mais sobre seu trabalho.').max(600).refine(value=>!/(?:\S+@\S+|\+?\d[\d ()-]{8,}\d|https?:\/\/|www\.)/i.test(value),'Não inclua contatos na apresentação pública.'),
  services:z.array(z.number().int().positive()).min(1,'Selecione pelo menos um serviço.').max(150),
  cities:z.array(z.number().int().positive()).min(1,'Selecione uma cidade.').max(50),
});
export const registrationSchema=z.object({
  name:z.string().trim().min(3,'Informe seu nome completo.').max(100),
  email:z.email('Informe um e-mail válido.').transform(value=>value.toLowerCase()),
  phone:z.string().regex(/^\+55\d{10,11}$/,'Informe um telefone brasileiro com DDD.'),
  password:z.string().min(10,'Use uma senha com pelo menos 10 caracteres.').max(128),
  role:z.enum(['client','pro']),consent:z.literal(true),
  cityId:z.number().int().positive().default(1721000),
  neighborhood:z.string().trim().max(100).default(''),
  professional:serviceProfileSchema.optional(),
}).superRefine((value,context)=>{
  if(value.role==='pro'&&!value.professional)context.addIssue({code:'custom',path:['professional'],message:'Complete os dados profissionais e selecione seus serviços.'});
  if(value.role==='client'&&value.professional)context.addIssue({code:'custom',path:['professional'],message:'O perfil profissional exige uma conta de profissional.'});
});
export const accountSchema=z.object({name:z.string().trim().min(3).max(100),cityId:z.number().int().positive(),neighborhood:z.string().trim().max(100)});
export type RegistrationInput=z.infer<typeof registrationSchema>;
export type Account={id:number;name:string;email:string;phone:string;phoneVerified:boolean;cityId:number|null;neighborhood:string;role:'client'|'pro'|'admin'};
export type ProfessionalProfile=z.infer<typeof serviceProfileSchema>&{verification_status?:string};
export type DemoSettings={enabled:boolean;available:boolean;effective:boolean};
