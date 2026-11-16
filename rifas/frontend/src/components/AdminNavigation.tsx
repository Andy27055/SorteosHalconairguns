import {Nav} from 'react-bootstrap';
const sections=[
 {id:'orders',label:'Compras y comprobantes',description:'Revisar y aprobar los pagos',icon:'M4 3h16v18l-4-2-4 2-4-2-4 2V3Zm4 5h8m-8 4h8',count:'pendingReviews'},
 {id:'refunds',label:'Devoluciones',description:'Pendientes e historial de reembolsos',icon:'M4 9h10a6 6 0 0 1 0 12h-3M4 9l5-5M4 9l5 5',count:'pendingRefunds'},
 {id:'raffles',label:'Rifas',description:'Crear, activar y finalizar rifas',icon:'M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Zm8 0v14',count:'raffles'},
 {id:'prizes',label:'Premios',description:'Productos y números gratis',icon:'M3 8h18v4H3V8Zm2 4v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z'},
 {id:'users',label:'Participantes',description:'Cuentas, permisos y perfiles',icon:'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 5 0 0 1 16 0v2',count:'users'},
 {id:'buyers',label:'Compradores',description:'Listados por rifa y descarga Excel',icon:'M8 3h12v18H4V7h4V3Zm0 0v4H4m4 4h8m-8 4h8m-8 3h5'},
 {id:'audit',label:'Actividad',description:'Acciones de los administradores',icon:'M8 3h12v18H4V7h4V3Zm2 7h6m-6 4h6m-6 4h6'},
] as const;
export function AdminNavigation({counts}:{counts:{raffles?:number;users?:number;pendingReviews?:number;pendingRefunds?:number}}){
 return <Nav className="admin-navigation" role="tablist" aria-label="Secciones de administración">{sections.map(section=><Nav.Item key={section.id}><Nav.Link as="button" type="button" role="tab" eventKey={section.id} aria-label={section.label} className="admin-navigation-card"><span className="admin-navigation-top"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={section.icon}/></svg>{'count' in section&&counts[section.count]!=null&&<span className="admin-navigation-count">{counts[section.count]}</span>}</span><strong>{section.label}</strong><span className="admin-navigation-description">{section.description}</span></Nav.Link></Nav.Item>)}</Nav>;
}
