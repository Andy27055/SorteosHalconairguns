import type { Order, PaymentConfig, TransferAccount } from '../types';
import { CopyValue } from './CopyValue';
export function TransferAccountPicker({ accounts, value, onChange, disabled }: { accounts: TransferAccount[]; value: string; onChange: (id: string) => void; disabled: boolean }) {
  if (!accounts.length) return null;
  return <div className="transfer-account-picker field"><label htmlFor="transfer-account">Cuenta para tu transferencia</label><select id="transfer-account" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{accounts.map(a=><option value={a.id} key={a.id}>{a.holder} · {a.alias || a.cbu}</option>)}</select><small>Elegí una cuenta y verificá el titular en tu banco antes de transferir. Enviá el importe completo a esa cuenta.</small></div>;
}
export function TransferDetails({ order, config }: { order: Order; config?: PaymentConfig | null }) {
  const fixed = !!(order.transferAccountId || order.transferHolder);
  const holder = fixed ? order.transferHolder : config?.transferHolder;
  const alias = fixed ? order.transferAlias : config?.transferAlias;
  const cbu = fixed ? order.transferCbu : config?.transferCbu;
  return <div className="bank-details"><h3>DATOS PARA TRANSFERIR</h3><div className="transfer-copy-details"><div className="transfer-holder"><span>Titular</span><strong>{holder}</strong></div>{alias && <CopyValue label="Alias" value={alias}/ >}{cbu && <CopyValue label="CBU / CVU" value={cbu}/>}<CopyValue label="Importe exacto" value={(order.amountCents/100).toFixed(2).replace('.',',')}/><CopyValue label="Referencia" value={order.id}/></div><p className="small muted">Confirmá que el banco muestre el titular indicado. Después de transferir, adjuntá el comprobante para su revisión.</p></div>;
}
