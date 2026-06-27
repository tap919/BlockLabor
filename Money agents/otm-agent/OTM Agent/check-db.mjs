import { PrismaClient } from './node_modules/.prisma/client/default.js';

const p = new PrismaClient();

const jobs = await p.queuedJob.findMany({ take: 3, orderBy: { queuedAt: 'desc' } });
console.log('=== Latest QueuedJobs ===');
for (const j of jobs) {
  console.log(`  ${j.id} | ${j.src} | ${j.status} | earned: $${j.earnedUsd} | ${j.result?.slice(0, 120)}`);
}

const earnings = await p.earning.findMany({ take: 5 });
console.log(`\nEarnings count: ${earnings.length}`);

// Check Scale AI pending tasks
const { listTasks } = await import('./src/lib/scale-ai.ts');
const pending = await listTasks('pending', 5);
console.log(`\nScale AI pending tasks: ${pending.total}`);
for (const t of pending.docs) {
  console.log(`  ${t.task_id} | ${t.status} | ${t.created_at}`);
}

await p.$disconnect();
