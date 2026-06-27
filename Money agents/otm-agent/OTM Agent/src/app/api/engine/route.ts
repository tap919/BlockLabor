/**
 * GET  /api/engine         — Get engine status
 * POST /api/engine         — Start/stop/run-cycle/config the engine
 *
 * Controls the local autonomous engine directly (no gateway proxy).
 * Returns real engine state — NEVER fake data.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  startEngine,
  stopEngine,
  runSingleCycle,
  getStatus,
  updateConfig,
} from "@/lib/autonomous-engine";

export async function GET() {
  try {
    const status = getStatus();
    return NextResponse.json({ source: "local", ...status });
  } catch (error) {
    return NextResponse.json(
      {
        source: "error",
        error: error instanceof Error ? error.message : "Failed to get engine status",
        isRunning: false,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "start": {
        const status = startEngine(params.config);
        return NextResponse.json({
          source: "local",
          success: true,
          message: status.running ? "Engine started" : "Engine was already running",
          ...status,
        });
      }

      case "stop": {
        const status = stopEngine();
        return NextResponse.json({
          source: "local",
          success: true,
          message: "Engine stopped",
          ...status,
        });
      }

      case "run_cycle": {
        const cycleResult = await runSingleCycle();
        return NextResponse.json({
          source: "local",
          success: true,
          message: `Cycle ${cycleResult.cycleNumber} completed in ${(cycleResult.durationMs / 1000).toFixed(1)}s`,
          cycle: cycleResult,
          status: getStatus(),
        });
      }

      case "config": {
        const updatedConfig = updateConfig(params.config ?? params);
        return NextResponse.json({
          source: "local",
          success: true,
          message: "Config updated",
          config: updatedConfig,
          status: getStatus(),
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}. Valid actions: start, stop, run_cycle, config`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 },
    );
  }
}
