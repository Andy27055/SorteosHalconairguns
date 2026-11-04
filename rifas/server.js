// Entrada compatible: primero ejecutar npm run build.
import('./backend/dist/index.js').catch(() => { console.error('No se pudo iniciar. Revisá PostgreSQL y backend/.env; ejecutá npm run build y npm start.'); process.exitCode = 1; });
