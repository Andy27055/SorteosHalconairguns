import '../src/config.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';
import { registerSchema } from '../src/schemas.js';
try {
  if (process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
    const data = registerSchema.parse({ username: process.env.ADMIN_USERNAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, fullName: 'Administrador Halcón Airguns' });
    const existing = await prisma.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.email }] } });
    if (existing && existing.role !== 'ADMIN') throw new Error('La identidad elegida ya pertenece a un participante. Usá una identidad administrativa nueva.');
    if (!existing) await prisma.user.create({ data: { username: data.username, email: data.email, fullName: data.fullName, passwordHash: await bcrypt.hash(data.password,12), role:'ADMIN' } });
    console.log('Cuenta administrativa verificada; no se cambian contraseñas existentes.');
  } else console.log('Sin ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD: no se crean administradores.');
  if (process.env.SEED_DEMO === 'true') {
    const prize=await prisma.prize.upsert({ where:{id:'demo-premio'},update:{},create:{id:'demo-premio',name:'Premio de demostración',description:'Datos de prueba. No representa una rifa real.'} });
    await prisma.raffle.upsert({where:{id:'demo-rifa'},update:{},create:{id:'demo-rifa',title:'Rifa de demostración',description:'Ejemplo para probar reservas. No realizar pagos reales.',prizeId:prize.id,ticketPriceCents:500000,totalTickets:100,status:'ACTIVE'}});
    if(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD){
      const data=registerSchema.parse({username:'participante-demo',email:process.env.DEMO_EMAIL,password:process.env.DEMO_PASSWORD,fullName:'Participante de demostración'});
      await prisma.user.upsert({where:{username:data.username},update:{},create:{username:data.username,email:data.email,fullName:data.fullName,passwordHash:await bcrypt.hash(data.password,12),role:'USER'}});
    }
    console.log('Datos de demostración verificados.');
  }
} finally { await prisma.$disconnect(); }
