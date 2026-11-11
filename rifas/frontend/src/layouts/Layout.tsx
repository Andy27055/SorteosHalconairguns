import { OfficialLinks } from '../components/OfficialLinks';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useLayoutEffect } from 'react';
import { useAuth } from '../auth';
import { ErrorBox } from '../components/UI';
export function Layout() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState('');
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  async function exit() { try { await logout(); navigate('/'); } catch (e) { setError((e as Error).message); } }
  return <><a className="skip-link" href="#contenido">Ir al contenido</a><div className="topline"><span>HALCÓN AIRGUNS</span><span>PRECISIÓN. PASIÓN. TU PRÓXIMA OPORTUNIDAD.</span></div><header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="Halcón Airguns, inicio"><img src="/logo.png" alt="Logo Halcón Airguns"/><span>HALCÓN <b>AIRGUNS</b><small>RIFAS OFICIALES</small></span></Link><nav aria-label="Navegación principal"><NavLink to="/" end>Rifas</NavLink>{user && <NavLink to="/compras">Mis números</NavLink>}{user?.role === 'ADMIN' && <NavLink to="/admin">Administración</NavLink>}<OfficialLinks/></nav><div className="account-nav">{user ? <><Link to="/perfil" className="account-name">{user.username}</Link><button className="text-button" onClick={() => void exit()}>Salir</button></> : <Link className="btn btn-outline-primary btn-sm" to="/ingresar">Ingresar <span aria-hidden>↗</span></Link>}</div></div></header><main id="contenido" className="main-content"><ErrorBox message={error}/><Outlet/></main><footer className="site-footer"><div><Link to="/" className="footer-brand"><img src="/logo.png" alt="Halcón Airguns"/><span>HALCÓN AIRGUNS<small>La pasión nos une.</small></span></Link></div><div><Link to="/condiciones">Cómo participar y condiciones</Link><span>© {new Date().getFullYear()} Halcón Airguns</span></div></footer></>;
}
