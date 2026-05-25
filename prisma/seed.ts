import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  log: [{ emit: 'stdout', level: 'error' }],
})

async function seed() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@file.sbc.om').toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'System Administrator'

  if (!password) {
    console.warn('⚠  ADMIN_PASSWORD is not set — skipping admin seed')
    return
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters for security')
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, name: true },
  })

  if (existing) {
    if (existing.role === UserRole.ADMIN) {
      console.log(`✓ Admin already exists [${email}] — nothing to do`)
    } else {
      await prisma.user.update({
        where: { email },
        data: { role: UserRole.ADMIN, emailVerified: true, isActive: true },
      })
      console.log(`✓ User [${email}] promoted to ADMIN`)
    }
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true },
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  ✓ Admin user created successfully')
  console.log(`  • ID    : ${user.id}`)
  console.log(`  • Name  : ${user.name}`)
  console.log(`  • Email : ${user.email}`)
  console.log(`  • Role  : ${user.role}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

seed()
  .catch((e) => {
    console.error('✗ Seed failed:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
