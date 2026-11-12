import { useState } from 'react';
import { Button,Modal } from 'react-bootstrap';
import { useFetch } from '../hooks/useFetch';
import { ErrorBox,Loading } from './UI';
import { date,adminLabel,type User } from '../types';
interface ActivityPage {items:{id:string;actor:string;description:string;context:string;createdAt:string}[];page:number;total:number}
export function ActivityPanel({path='/profile/activity',admin=false}:{path?:string;admin?:boolean}){
 const [page,setPage]=useState(1);const history=useFetch<ActivityPage>(`${path}?page=${page}`,15000);
 return <section className="activity-panel"><h2>{admin?'ACTIVIDAD DE ADMINISTRADORES':'HISTORIAL DE LA CUENTA'}</h2><p className="small muted">{admin?'Acciones realizadas por administradores.':'Este historial sólo puede consultarlo el titular de la cuenta o un administrador.'}</p><ErrorBox message={history.error} retry={history.refresh}/>{history.loading&&<Loading/>}<div className="audit-list">{history.data?.items?.map(item=><article key={item.id}><div><b>{item.actor}</b><p>{item.description}</p>{item.context&&<span>{item.context}</span>}</div><small>{date(item.createdAt)}</small></article>)}</div>{history.data?.total===0&&<p>No hay movimientos registrados.</p>}{history.data&&history.data.total>50&&<div className="pagination-row"><Button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</Button><span>{page} / {Math.ceil(history.data.total/50)}</span><Button disabled={page*50>=history.data.total} onClick={()=>setPage(page+1)}>Siguiente</Button></div>}</section>;
}
export function UserProfileDialog({id,onClose}:{id:string;onClose:()=>void}){
 const profile=useFetch<User>(`/admin/users/${encodeURIComponent(id)}`);
 return <Modal show centered scrollable size="lg" onHide={onClose}><Modal.Header closeButton><Modal.Title>PERFIL DEL USUARIO</Modal.Title></Modal.Header><Modal.Body><ErrorBox message={profile.error}/>{profile.loading&&<Loading/>}{profile.data&&<><h3>{profile.data.fullName}</h3><p>{profile.data.username}<br/>{adminLabel(profile.data)}<br/>{profile.data.email}<br/>DNI: {profile.data.dni||'Sin completar'}<br/>Domicilio: {profile.data.address||'Sin completar'}<br/>Correo: {profile.data.emailVerifiedAt?'Verificado':'Sin verificar'}</p><ActivityPanel path={`/admin/users/${encodeURIComponent(id)}/activity`}/></>}</Modal.Body></Modal>;
}
