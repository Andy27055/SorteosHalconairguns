import type {PrizeKind} from '../types';
export function PrizeKindField({id,value,onChange,disabled=false}:{id:string;value:PrizeKind;onChange:(value:PrizeKind)=>void;disabled?:boolean}){
 return <div className="field"><label htmlFor={id}>Tipo de premio</label><select id={id} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as PrizeKind)}><option value="ITEM">Producto u otro premio</option><option value="FREE_TICKET">Número gratis para la siguiente rifa</option></select>{value==='FREE_TICKET'&&<small>Cada unidad entrega un número gratis al ganador. La cantidad se configura en los premios del puesto.</small>}</div>;
}
