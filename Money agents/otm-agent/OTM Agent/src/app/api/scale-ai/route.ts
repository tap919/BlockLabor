/**
 * Scale AI API routes — REMOVED.
 *
 * The Scale AI account is a REQUESTER account (pays workers, does not earn).
 * All Scale AI integration has been intentionally removed from OTM Agent.
 * This file returns 410 Gone to clearly indicate the endpoint is retired.
 */
import { NextResponse } from "next/server";

const GONE = { source: "removed", error: "Scale AI integration has been removed. This account is a requester (pays workers), not an earner." };

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}
