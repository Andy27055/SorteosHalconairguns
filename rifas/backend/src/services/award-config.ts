import type {Prisma} from '../generated/prisma/client.js';
import {AppError} from '../errors.js';

export const awardInclude = {awards:{include:{prizes:true},orderBy:{rank:'asc' as const}}} as const;
export interface AwardInput {rank:number;prizes:{prizeId:string;quantity:number}[]}
export async function snapshotAwards(tx:Prisma.TransactionClient, awards:AwardInput[]){
  const ids=[...new Set(awards.flatMap(a=>a.prizes.map(p=>p.prizeId)))];
  const prizes=await tx.prize.findMany({where:{id:{in:ids}}});
  if(prizes.length!==ids.length)throw new AppError(400,'Uno de los premios ya no existe. Revisá los premios de cada puesto.');
  const catalog=new Map(prizes.map(p=>[p.id,p]));
  return awards.map(a=>({rank:a.rank,prizes:{create:a.prizes.map(p=>({prizeId:p.prizeId,quantity:p.quantity,name:catalog.get(p.prizeId)!.name,description:catalog.get(p.prizeId)!.description,kind:catalog.get(p.prizeId)!.kind}))}}));
}
export function sameAwards(left:AwardInput[],right:AwardInput[]){
  const normalized=(items:AwardInput[])=>JSON.stringify(items.map(a=>({rank:a.rank,prizes:a.prizes.map(p=>({prizeId:p.prizeId,quantity:p.quantity})).sort((a,b)=>a.prizeId.localeCompare(b.prizeId))})).sort((a,b)=>a.rank-b.rank));
  return normalized(left)===normalized(right);
}
export function prizeText(prizes:{name:string;quantity:number}[]){return prizes.map(p=>`${p.quantity>1?`${p.quantity} × `:''}${p.name}`).join(' + ');}
