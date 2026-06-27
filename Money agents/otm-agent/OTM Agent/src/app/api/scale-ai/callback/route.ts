/**
 * Scale AI callback — REMOVED.
 *
 * The Scale AI account is a REQUESTER account. No tasks are submitted,
 * so no callbacks will arrive. Returns 200 to prevent retry storms if
 * Scale AI ever sends a stale callback.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, note: "Scale AI integration removed. Callback acknowledged and discarded." });
}
