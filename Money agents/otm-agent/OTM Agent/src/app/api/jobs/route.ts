/**
 * GET /api/jobs
 * Returns recent jobs from the database
 */
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    
    const jobs = await db.queuedJob.findMany({
      orderBy: { completedAt: "desc" },
      take: 20,
      select: {
        id: true,
        src: true,
        status: true,
        result: true,
        earnedUsd: true,
        completedAt: true,
      },
    });
    
    await db.$disconnect();
    
    return NextResponse.json({ 
      jobs: jobs.map(j => ({
        src: j.src,
        status: j.status,
        result: j.result || "",
        earnedUsd: j.earnedUsd?.toString() || "0",
        completedAt: j.completedAt?.toISOString() || ""
      }))
    });
  } catch (e) {
    return NextResponse.json({ 
      jobs: [],
      error: e instanceof Error ? e.message : "Unknown error" 
    }, { status: 500 });
  }
}
