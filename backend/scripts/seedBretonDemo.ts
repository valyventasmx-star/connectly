/**
 * seedBretonDemo.ts
 *
 * Safe one-time seed: creates the "breton_demo" workspace in Connectly if it
 * does not already exist. Never overwrites or modifies an existing workspace.
 *
 * Run from the backend directory:
 *   DATABASE_URL="..." npx ts-node --project tsconfig.json scripts/seedBretonDemo.ts
 *
 * Or with the .env file loaded:
 *   npx ts-node -r dotenv/config --project tsconfig.json scripts/seedBretonDemo.ts
 *
 * When running against Railway production DB:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@switchback.proxy.rlwy.net:44983/railway" \
 *     npx ts-node -r dotenv/config --project tsconfig.json scripts/seedBretonDemo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WORKSPACE_SLUG = 'breton_demo';

async function main() {
  console.log(`\n🔍 Checking for workspace slug="${WORKSPACE_SLUG}"…\n`);

  const existing = await prisma.workspace.findUnique({
    where: { slug: WORKSPACE_SLUG },
  });

  if (existing) {
    console.log('✅ Workspace already exists — nothing changed.\n');
    console.log(`   id:   ${existing.id}`);
    console.log(`   name: ${existing.name}`);
    console.log(`   slug: ${existing.slug}`);
    console.log(`   plan: ${existing.plan}\n`);
    return;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Breton Demo',
      slug: WORKSPACE_SLUG,
      description: 'WhatsApp sandbox demo workspace for Valy bot',
      timezone: 'America/Mexico_City',
      plan: 'free',
      aiEnabled: false,
      slaHours: 24,
      onboardingCompleted: true, // skip onboarding wizard for this workspace
    },
  });

  console.log('🎉 Workspace created successfully!\n');
  console.log(`   id:   ${workspace.id}`);
  console.log(`   name: ${workspace.name}`);
  console.log(`   slug: ${workspace.slug}\n`);
  console.log('Next steps:');
  console.log('  1. Log in to Connectly and switch to the "Breton Demo" workspace');
  console.log('     (use the workspace switcher in the sidebar).');
  console.log('  2. Add yourself as a member in Settings → Members & Roles.');
  console.log('     (Or register with the same email that owns the workspace.)');
  console.log('  3. Send a WhatsApp message from the sandbox number — it will');
  console.log('     appear in the Inbox automatically.\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
