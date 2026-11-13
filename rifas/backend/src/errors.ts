import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { transactionConflict } from './transaction-conflict.js';
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const asyncRoute = (fn: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Revisá los campos indicados.', fields: error.flatten().fieldErrors }); return;
  }
  if (error instanceof AppError) { res.status(error.status).json({ error: error.message }); return; }
  if (transactionConflict(error)) { res.status(409).json({ error: 'Hubo otra operación simultánea. Volvé a intentarlo.' }); return; }
  if (error instanceof multer.MulterError) { res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'El comprobante debe pesar hasta 5 MB.' : 'La carga del archivo no es válida.' }); return; }
  const code = (error as {code?: string}).code;
  const mapped: Record<string, [number, string]> = {
    P2002: [409, 'El dato ya existe o ese número acaba de reservarse. Actualizá e intentá con otro.'],
    P2003: [409, 'Este registro está asociado a otras operaciones y no puede eliminarse.'],
    P2025: [404, 'No encontramos el registro solicitado.'],
    P2034: [409, 'Hubo otra operación simultánea. Volvé a intentarlo.'],
    P1001: [503, 'No se pudo conectar con la base de datos. Intentá más tarde.'],
  };
  if (code && mapped[code]) { const [status, message] = mapped[code]; res.status(status).json({ error: message }); return; }
  if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'El JSON enviado no es válido.' }); return; }
  console.error('[API]', { type: error instanceof Error ? error.name : 'Error', code: code || 'UNEXPECTED' });
  res.status(500).json({ error: 'No pudimos completar la operación. Intentá nuevamente.' });
};
