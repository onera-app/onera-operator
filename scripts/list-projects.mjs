import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../node_modules/.pnpm/@prisma+client@6.19.2_prisma@6.19.2_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client/index.js');
const prisma = new PrismaClient({ datasourceUrl: 'postgresql://neondb_owner:npg_2XFpzNEfTRe3@ep-frosty-cell-aild3cjn-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require' });
const projects = await prisma.project.findMany({ include: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: 'desc' } });
for (const p of projects) {
  console.log(`${p.name} | website: ${p.website || 'none'} | companyEmail: ${p.companyEmail || 'none'} | owner: ${p.user?.name || 'unknown'} <${p.user?.email || 'no email'}> | id: ${p.id}`);
}
await prisma.$disconnect();
