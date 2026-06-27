import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const AGENTS = [
  {
    name: 'sentinel',
    displayName: 'Sentinel',
    description: 'Macro-economic analyst that monitors market trends and economic indicators',
    icon: 'Radar',
    color: 'text-blue-500',
    version: '1.0.0'
  },
  {
    name: 'cipher',
    displayName: 'Cipher',
    description: 'Quantitative analyst that runs financial models and simulations',
    icon: 'Calculator',
    color: 'text-purple-500',
    version: '1.0.0'
  },
  {
    name: 'guardian',
    displayName: 'Guardian',
    description: 'Security and compliance monitor that validates agent outputs',
    icon: 'Shield',
    color: 'text-red-500',
    version: '1.0.0'
  },
  {
    name: 'oracle',
    displayName: 'Oracle',
    description: 'Strategic synthesizer that aggregates insights and provides recommendations',
    icon: 'Sparkles',
    color: 'text-amber-500',
    version: '1.0.0'
  },
  {
    name: 'vector',
    displayName: 'Vector',
    description: 'Marketing analyst that models customer acquisition and lifetime value',
    icon: 'TrendingUp',
    color: 'text-green-500',
    version: '1.0.0'
  },
  {
    name: 'ledger',
    displayName: 'Ledger',
    description: 'Compliance and audit agent that ensures regulatory adherence',
    icon: 'BookOpen',
    color: 'text-indigo-500',
    version: '1.0.0'
  }
]

async function main() {
  for (const agent of AGENTS) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      create: agent,
      update: agent
    })
    console.log(`✅ Created/Updated: ${agent.displayName}`)
  }
  console.log('\nAll agents seeded!')
  await prisma.$disconnect()
}
main()
