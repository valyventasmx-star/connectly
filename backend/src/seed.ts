import 'dotenv/config';
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@connectly.app' },
    update: {},
    create: { name: 'Admin User', email: 'admin@connectly.app', password },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'my-workspace' },
    update: {},
    create: {
      name: 'My Workspace',
      slug: 'my-workspace',
      description: 'Default workspace',
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });

  // Create a demo WhatsApp channel
  await prisma.channel.upsert({
    where: { id: 'demo-channel-1' },
    update: {},
    create: {
      id: 'demo-channel-1',
      name: 'WhatsApp Business',
      type: 'whatsapp',
      phoneNumber: '+1234567890',
      status: 'pending',
      workspaceId: workspace.id,
      webhookVerifyToken: 'demo-verify-token-123',
    },
  });

  // Create demo contacts
  const contacts = [
    { name: 'John Smith', phone: '+15551234567', email: 'john@example.com', company: 'Acme Corp' },
    { name: 'Sarah Johnson', phone: '+15559876543', email: 'sarah@example.com', company: 'Tech Inc' },
    { name: 'Maria Garcia', phone: '+15555555555', email: 'maria@example.com', company: 'Design Co' },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { id: `demo-contact-${c.phone}` },
      update: {},
      create: { id: `demo-contact-${c.phone}`, ...c, workspaceId: workspace.id },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('📧 Login: admin@connectly.app');
  console.log('🔑 Password: admin123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
