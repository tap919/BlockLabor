import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const agents = await prisma.agent.count()
  const projects = await prisma.project.count()
  const phases = await prisma.phase.count()
  const portfolios = await prisma.portfolio.count()
  
  console.log(`   - Agents: ${agents}`)
  console.log(`   - Projects: ${projects}`)
  console.log(`   - Phases: ${phases}`)
  console.log(`   - Portfolios: ${portfolios}`)
  await prisma.$disconnect()
}
main()
