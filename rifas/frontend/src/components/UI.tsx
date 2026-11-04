import { Alert, Button, Spinner } from 'react-bootstrap';
import type { OrderStatus } from '../types';
import { statusLabels } from '../types';
export function Loading() { return <div className="loading-state" role="status"><Spinner size="sm" /> Cargando…</div>; }
export function ErrorBox({ message, retry }: { message: string; retry?: () => unknown }) { return message ? <Alert variant="danger" role="alert">{message}{retry && <Button variant="outline-light" size="sm" className="ms-3" onClick={() => void retry()}>Reintentar</Button>}</Alert> : null; }
export function Status({ value }: { value: OrderStatus }) { return <span className={`status status-${value.toLowerCase()}`}>{statusLabels[value]}</span>; }
export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>; }
