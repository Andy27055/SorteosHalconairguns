import {useState,type FormEvent} from 'react';
import {Button,Modal} from 'react-bootstrap';
import {api,post,ApiError} from '../api';
import {useFetch} from '../hooks/useFetch';
import {adminLabel,type User} from '../types';
import {ErrorBox,Loading} from './UI';
import {PasswordInput} from './PasswordInput';

type Changed=(message:string)=>Promise<void>;
export function AccountCreateDialog({onClose,onChanged}:{onClose:()=>void;onChanged:Changed}){
 const [form,setForm]=useState({firstName:'',lastName:'',username:'',email:'',dni:'',password:'',role:'USER',sendVerification:true});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[fields,setFields]=useState<Record<string,string[]>>({});
 function textField(key:'firstName'|'lastName'|'username'|'email'|'dni',label:string,maxLength:number,required=true){return <div className="field"><label htmlFor={`account-${key}`}>{label}</label><input id={`account-${key}`} value={form[key]} type={key==='email'?'email':'text'} maxLength={maxLength} required={required} disabled={busy} autoComplete="off" onChange={e=>setForm({...form,[key]:e.target.value})}/>{fields[key]?.map((s,i)=><small className="field-error" key={i}>{s}</small>)}</div>;}
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setFields({});try{
  await post('/admin/users',{...form,firstName:form.firstName.trim(),lastName:form.lastName.trim(),username:form.username.trim(),email:form.email.trim(),dni:form.dni.trim()||undefined});
  await onChanged(form.sendVerification?'Cuenta creada. Se preparó el correo de verificación; se enviará cuando el servicio de correo esté habilitado.':'Cuenta creada.');onClose();
 }catch(e){setError((e as Error).message);if(e instanceof ApiError)setFields(e.fields);}finally{setBusy(false);}}
 return <Modal show centered scrollable onHide={()=>!busy&&onClose()} aria-labelledby="account-create-title"><Modal.Header closeButton={!busy}><Modal.Title id="account-create-title">CREAR CUENTA</Modal.Title></Modal.Header><Modal.Body><ErrorBox message={error}/><form id="account-create-form" onSubmit={submit}>
  {textField('firstName','Nombre',80)}{textField('lastName','Apellido',80)}{textField('username','Usuario',30)}{textField('email','Correo electrónico',254)}{textField('dni','DNI (opcional)',8,false)}
  <div className="field"><label htmlFor="account-password">Contraseña inicial</label><PasswordInput id="account-password" value={form.password} minLength={10} maxLength={128} required disabled={busy} autoComplete="new-password" onChange={e=>setForm({...form,password:e.target.value})}/><small>Al menos 10 caracteres. Compartila con el titular de forma privada.</small>{fields.password?.map((s,i)=><small className="field-error" key={i}>{s}</small>)}</div>
  <div className="field"><label htmlFor="account-role">Tipo de cuenta</label><select id="account-role" value={form.role} disabled={busy} onChange={e=>setForm({...form,role:e.target.value})}><option value="USER">Cliente</option><option value="ADMIN">Administrador funcional</option></select><small>La cuenta principal de desarrollo se conserva.</small></div>
  <label className="d-flex gap-2 align-items-start"><input type="checkbox" checked={form.sendVerification} disabled={busy} onChange={e=>setForm({...form,sendVerification:e.target.checked})}/>Enviar correo para verificar la cuenta</label><p className="small muted mt-2">El correo permite verificar la dirección y establecer una contraseña propia. Avisale al titular que revise también Spam.</p>
 </form></Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" form="account-create-form" disabled={busy}>{busy?'CREANDO…':'CREAR CUENTA'}</Button></Modal.Footer></Modal>;
}

interface DeletionPreview {user:User;orders:number;activeOrders:number;activeBenefits:number;canDelete:boolean}
export function AccountDeleteDialog({user,onClose,onChanged}:{user:User;onClose:()=>void;onChanged:Changed}){
 const preview=useFetch<DeletionPreview>(`/admin/users/${encodeURIComponent(user.id)}/deletion-preview`);
 const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();if(busy||confirmation!=='CONFIRMAR'||!preview.data?.canDelete)return;setBusy(true);setError('');try{
  await api(`/admin/users/${encodeURIComponent(user.id)}/permanent`,{method:'DELETE',body:JSON.stringify({confirmation})});
  await onChanged('Cuenta eliminada. Su historial de compras se conserva en las rifas.');onClose();
 }catch(e){setError((e as Error).message);await preview.refresh();}finally{setBusy(false);}}
 async function deactivate(){if(busy)return;setBusy(true);setError('');try{await api(`/admin/users/${encodeURIComponent(user.id)}`,{method:'DELETE'});await onChanged('Cuenta desactivada. Se conserva su historial y se cerraron sus sesiones.');onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const account=preview.data?.user||user;
 return <Modal show centered scrollable onHide={()=>!busy&&onClose()} aria-labelledby="account-delete-title"><Modal.Header closeButton={!busy}><Modal.Title id="account-delete-title">ELIMINAR CUENTA</Modal.Title></Modal.Header><Modal.Body><h3>{account.fullName}</h3><p>{account.username}<br/>{account.email}<br/>{adminLabel(account)} · {account.active?'Activa':'Desactivada'}</p><ErrorBox message={error}/><ErrorBox message={preview.error} retry={preview.refresh}/>{preview.loading?<Loading/>:preview.data&&<>
  <p>Compras en el historial: {preview.data.orders}.<br/>Compras o gestiones pendientes: {preview.data.activeOrders}.<br/>Números gratis sin usar: {preview.data.activeBenefits}.</p>
  {preview.data.canDelete?<form id="account-delete-form" onSubmit={submit}><p>La cuenta se eliminará de forma permanente y sus sesiones dejarán de funcionar. Los datos y números de sus compras se conservarán en las rifas y en los Excel. Esta acción no se puede deshacer.</p><div className="field"><label htmlFor="account-delete-confirmation">Escribí CONFIRMAR para eliminar esta cuenta</label><input id="account-delete-confirmation" autoComplete="off" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></div></form>:<p className="notice">Tiene compras, reservas, reembolsos o premios pendientes. Sólo se puede desactivar hasta resolverlos. Desactivarla impide el acceso y conserva todas sus participaciones.</p>}
 </>}</Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={busy} onClick={onClose}>Cancelar</Button>{preview.data?.canDelete?<Button variant="danger" type="submit" form="account-delete-form" disabled={busy||!!preview.error||confirmation!=='CONFIRMAR'}>{busy?'ELIMINANDO…':'ELIMINAR DEFINITIVAMENTE'}</Button>:preview.data&&account.active&&<Button variant="danger" disabled={busy||!!preview.error} onClick={()=>void deactivate()}>{busy?'DESACTIVANDO…':'DESACTIVAR CUENTA'}</Button>}</Modal.Footer></Modal>;
}
