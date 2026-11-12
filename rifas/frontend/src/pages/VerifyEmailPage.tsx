import { EmailDeliveryNotice } from '../components/EmailDeliveryNotice';
import { useEffect,useState,type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { post } from '../api';
import { ErrorBox,PageTitle } from '../components/UI';
export function VerifyEmailPage(){
 const [token]=useState(()=>window.location.hash.slice(1));const [password,setPassword]=useState('');const [changePassword,setChangePassword]=useState(false);const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{window.history.replaceState(window.history.state,'',window.location.pathname);},[]);
 async function confirm(e:FormEvent){e.preventDefault();if(busy||!token)return;setBusy(true);setError('');try{await post('/auth/verify-email',{token,...(changePassword?{password}:{})});setDone(true);if(changePassword)window.dispatchEvent(new Event('session-expired'));}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <div className="page-wrap"><PageTitle eyebrow="TU CUENTA HALCÓN" title={done?'CORREO CONFIRMADO':'CONFIRMÁ TU CORREO'}/><section className="panel"><ErrorBox message={error}/>{done?<><p>Tu dirección de correo quedó verificada.{changePassword?' Ya podés ingresar con tu nueva contraseña.':''}</p><Link to="/ingresar" className="btn btn-primary">INICIAR SESIÓN</Link></>:token?<form onSubmit={confirm}><p>Confirmá que esta dirección de correo te pertenece. El enlace es personal y se puede usar una sola vez.</p><label><input type="checkbox" checked={changePassword} onChange={e=>setChangePassword(e.target.checked)}/> Quiero establecer una contraseña propia</label>{changePassword&&<div className="field"><label htmlFor="verification-password">Nueva contraseña</label><input id="verification-password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/><small>Usá al menos 10 caracteres.</small></div>}<div className="mt-4"><Button type="submit" disabled={busy}>{busy?'CONFIRMANDO…':'CONFIRMAR MI CORREO'}</Button></div></form>:<><p>Falta el enlace de confirmación. Solicitá uno nuevo desde tu perfil.</p><EmailDeliveryNotice/></>}</section></div>;
}
