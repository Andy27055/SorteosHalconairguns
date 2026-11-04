import '../src/config.js';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';
import { registerSchema } from '../src/schemas.js';
const username=(process.argv[2]||'').toLowerCase();
if(!username){console.error('Uso: node reset-password.js USUARIO (desde la raíz del proyecto)');process.exit(1);}
const hidden=new Writable({write(_chunk,_encoding,callback){callback();}});
const input=createInterface({input:process.stdin,output:hidden,terminal:true});
try{
  process.stdout.write('Nueva contraseña (oculta, mínimo 10 caracteres): ');
  const password=registerSchema.shape.password.parse(await input.question(''));
  process.stdout.write('\nRepetir contraseña: ');const confirmation=await input.question('');process.stdout.write('\n');
  if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');
  await prisma.user.update({where:{username},data:{passwordHash:await bcrypt.hash(password,12),tokenVersion:{increment:1}}});
  console.log('Contraseña actualizada. Se revocaron las sesiones existentes.');
}finally{input.close();await prisma.$disconnect();}
