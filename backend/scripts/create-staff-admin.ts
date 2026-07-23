import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Uso: npx ts-node scripts/create-staff-admin.ts "Nombre Completo" "email@ejemplo.com" "password123"');
    process.exit(1);
  }

  const [name, email, password] = args;

  // Simple validation
  if (!email.includes('@') || password.length < 8) {
    console.error('Error: Email inválido o la contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    
    if (existing) {
      console.log(`Usuario con email ${email} ya existe. Actualizando isStaff = true...`);
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          isStaff: true
        } as any // Bypass strict TS constraints si isStaff da falso positivo
      });
      console.log('✅ Usuario existente actualizado correctamente a Staff:');
      console.log(`- ID: ${updatedUser.id}`);
      console.log(`- Nombre: ${updatedUser.name}`);
      console.log(`- Rol anterior/RBAC mantenido.`);
      console.log(`- Staff: ${(updatedUser as any).isStaff}`);
    } else {
      console.log(`Usuario con email ${email} no existe. Creando nuevo Staff global...`);
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const superAdmin = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          isStaff: true,
          businessId: null,
          roleId: null
        } as any // Bypass strict TS constraints in script para permitir nulos
      });

      console.log('✅ Nuevo Staff SuperAdmin creado correctamente:');
      console.log(`- ID: ${superAdmin.id}`);
      console.log(`- Nombre: ${superAdmin.name}`);
      console.log(`- Email: ${superAdmin.email}`);
      console.log('- Role: Staff (isStaff: true)');
    }
  } catch (err) {
    console.error('Error de Base de Datos:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
