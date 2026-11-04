import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, Protected } from './auth';
import { Layout } from './layouts/Layout';
import { Home } from './pages/Home';
import { AuthPage } from './pages/AuthPage';
import { RafflePage } from './pages/RafflePage';
import { OrdersPage, OrderPage } from './pages/OrdersPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { ConditionsPage } from './pages/ConditionsPage';
import { PageTitle } from './components/UI';
export function App(){return <BrowserRouter><AuthProvider><Routes><Route element={<Layout/>}><Route index element={<Home/>}/><Route path="ingresar" element={<AuthPage key="login"/>}/><Route path="registro" element={<AuthPage key="register" register/>}/><Route path="rifas/:id" element={<RafflePage/>}/><Route path="compras" element={<Protected><OrdersPage/></Protected>}/><Route path="compras/:id" element={<Protected><OrderPage/></Protected>}/><Route path="compras/:id/resultado" element={<Protected><OrderPage/></Protected>}/><Route path="perfil" element={<Protected><ProfilePage/></Protected>}/><Route path="admin" element={<Protected admin><AdminPage/></Protected>}/><Route path="condiciones" element={<ConditionsPage/>}/><Route path="sin-permiso" element={<div className="page-wrap"><PageTitle eyebrow="ACCESO RESTRINGIDO" title="ESTA SECCIÓN REQUIERE OTROS PERMISOS."/><Link to="/" className="btn btn-primary">VOLVER AL INICIO</Link></div>}/><Route path="*" element={<div className="page-wrap"><PageTitle eyebrow="404" title="ESTA PÁGINA NO ESTÁ DISPONIBLE."/><Link to="/" className="btn btn-primary">EXPLORAR RIFAS</Link></div>}/></Route></Routes></AuthProvider></BrowserRouter>;}
