import { OfficialLinks } from '../components/OfficialLinks';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useLayoutEffect } from 'react';
import { useAuth } from '../auth';
import { ErrorBox } from '../components/UI';
import { Button, Modal } from 'react-bootstrap';
export function Layout() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [exiting, setExiting] = useState(false);
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  async function exit() {
    if (exiting) return;
    setExiting(true); setError('');
    try { await logout(); setConfirmLogout(false); navigate('/ingresar', { replace: true }); }
    catch (e) { setError((e as Error).message); }
    finally { setExiting(false); }
  }
  return <><a className="skip-link" href="#contenido">Ir al contenido</a><div className="topline"><span>HALCÓN AIRGUNS</span><span>PRECISIÓN. PASIÓN. TU PRÓXIMA OPORTUNIDAD.</span></div><header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="Halcón Airguns, inicio"><img src="/logo.png" alt="Logo Halcón Airguns"/><span>HALCÓN <b>AIRGUNS</b><small>RIFAS OFICIALES</small></span></Link><nav aria-label="Navegación principal"><NavLink to="/" end>Rifas</NavLink>{user && <NavLink to="/compras">Mis números</NavLink>}{user?.role === 'ADMIN' && <NavLink to="/admin">Administración</NavLink>}<OfficialLinks/></nav><div className="account-nav">{user ? <><Link to="/perfil" className="account-name">{user.username}</Link><button type="button" className="text-button" onClick={() => { setError(''); setConfirmLogout(true); }}>Cerrar sesión</button></> : <Link className="btn btn-outline-primary btn-sm" to="/ingresar">Ingresar <span aria-hidden>↗</span></Link>}</div></div></header><main id="contenido" className="main-content"><Outlet/></main><footer className="site-footer"><div><Link to="/" className="footer-brand"><img src="/logo.png" alt="Halcón Airguns"/><span>HALCÓN AIRGUNS<small>La pasión nos une.</small></span></Link></div><div><Link to="/condiciones">Cómo participar y condiciones</Link><span>© {new Date().getFullYear()} Halcón Airguns</span></div></footer><Modal show={confirmLogout && !!user} centered size="sm" aria-labelledby="logout-title" onHide={() => { if (!exiting) setConfirmLogout(false); }} backdrop={exiting ? 'static' : true} keyboard={!exiting}><Modal.Header closeButton={!exiting}><Modal.Title id="logout-title">Cerrar sesión</Modal.Title></Modal.Header><Modal.Body><p>¿Estás seguro de que querés cerrar sesión?</p><ErrorBox message={error}/></Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={exiting} onClick={() => setConfirmLogout(false)}>Cancelar</Button><Button disabled={exiting} onClick={() => void exit()}>{exiting ? 'Cerrando…' : 'Sí, estoy seguro'}</Button></Modal.Footer></Modal></>;
}
