const bcrypt = require('bcryptjs');
const fs     = require('fs');
const path   = require('path');

const USUARIO    = 'admin';       // <-- cambiá si querés resetear otro usuario
const NUEVA_PASS = 'admin123';    // <-- poné la contraseña que quieras

const dbPath = path.join(__dirname, 'data', 'db.json');
const db     = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const user = db.users.find(u => u.username === USUARIO);
if (!user) { console.log(`❌ Usuario "${USUARIO}" no encontrado.`); process.exit(1); }

const hash = bcrypt.hashSync(NUEVA_PASS, 10);
user.password = hash;

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`✅ Contraseña de "${USUARIO}" actualizada a "${NUEVA_PASS}"`);
