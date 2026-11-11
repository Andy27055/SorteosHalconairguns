export const rejectionReasons=[
  {code:'INCORRECT_AMOUNT',label:'Monto incorrecto',message:'El monto transferido no coincide con el importe de esta compra. La compra fue rechazada y el reembolso del importe efectivamente acreditado se gestionará en un plazo de 24 a 48 horas.'},
  {code:'INCORRECT_DETAILS',label:'Datos incorrectos',message:'Los datos de destino de la transferencia no coinciden con los informados para esta compra. Si transferiste a una cuenta diferente, Halcón Airguns no se hace responsable del error. Asegurate de revisar el alias y el titular antes de realizar una transferencia la próxima vez.'},
  {code:'PAYMENT_NOT_MADE',label:'Pago no realizado',message:'Aunque el comprobante y los datos de destino son correctos, la entidad bancaria no realizó la acreditación en la cuenta de destino. Revisá si se descontó el saldo de tu cuenta y consultá con tu banco para verificar el estado del movimiento.'},
] as const;
export type RejectionCode=typeof rejectionReasons[number]['code']|'OTHER';
export function RejectionReasons({onSelect,disabled,value}:{onSelect:(code:RejectionCode,message:string)=>void;disabled:boolean;value:RejectionCode}){
  return <div className="rejection-reasons" role="group" aria-label="Motivos comunes de rechazo">{rejectionReasons.map(reason=><button className="btn btn-outline-primary btn-sm" type="button" key={reason.code} disabled={disabled} aria-pressed={value===reason.code} onClick={()=>onSelect(reason.code,reason.message)}>{reason.label}</button>)}</div>;
}
