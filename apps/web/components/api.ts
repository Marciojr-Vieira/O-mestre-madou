import type { User } from '../../../packages/shared/src';
let accessToken='';
export type Session={user:User;token:string};
export function setSession(session:Session){accessToken=session.token;}
export function clearSession(){accessToken='';}
export async function api<T>(path:string,method='GET',body?:unknown,key?:string,retry=true):Promise<T>{
  const response=await fetch(`/v1${path}`,{method,credentials:'include',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`} : {}),...(key?{'Idempotency-Key':key}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  if(response.status===401 && retry && !['/auth/login','/auth/register','/auth/refresh','/auth/demo'].includes(path)){const session=await api<Session>('/auth/refresh','POST',undefined,undefined,false);setSession(session);return api(path,method,body,key,false);}
  const data=await response.json();if(!response.ok)throw new Error(data.error?.message || 'Não foi possível concluir.');return data as T;
}
