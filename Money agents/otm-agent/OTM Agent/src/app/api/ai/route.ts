import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

interface OpportunityAnalysis {
  feasibilityScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendedApproach: string;
  potentialRisks: string[];
  nextSteps: string[];
  timeToFirstDollar: string;
  confidenceScore: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function analyzeOpportunity(opportunity: {
  title: string;
  source: string;
  amount: string;
  score: number;
  bankroll: number;
}): Promise<OpportunityAnalysis> {
  try {
    const zai = await ZAI.create();

    const prompt = `You are an expert business analyst for the OTM Agent bootstrapping system. Analyze this money-making opportunity and provide a detailed assessment.

OPPORTUNITY: ${opportunity.title}
SOURCE: ${opportunity.source}
POTENTIAL EARNINGS: ${opportunity.amount}
CURRENT SCORE: ${opportunity.score}/100
USER'S BANKROLL: $${opportunity.bankroll}

Provide a JSON response with:
1. feasibilityScore (0-100): How realistic is this for someone with $${opportunity.bankroll}?
2. riskLevel: "Low", "Medium", or "High"
3. recommendedApproach: 2-3 sentence strategy to execute this
4. potentialRisks: array of 2-3 risk factors
5. nextSteps: array of 3-4 actionable steps
6. timeToFirstDollar: estimated time (e.g., "1-3 days")
7. confidenceScore (0-100): how confident are you in this analysis

Respond ONLY with valid JSON, no markdown or explanation.`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a precise business analyst. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback if parsing fails
    return getDefaultAnalysis(opportunity.score);
  } catch (error) {
    console.error("AI Analysis error:", error);
    return getDefaultAnalysis(opportunity.score);
  }
}

function getDefaultAnalysis(score: number): OpportunityAnalysis {
  return {
    feasibilityScore: score,
    riskLevel: score > 70 ? "Low" : score > 40 ? "Medium" : "High",
    recommendedApproach: "Start with minimal investment and test the waters before scaling up.",
    potentialRisks: ["Market competition", "Time investment required", "Learning curve"],
    nextSteps: [
      "Research the platform",
      "Set up necessary accounts",
      "Start with a small test",
      "Scale based on results",
    ],
    timeToFirstDollar: "1-7 days",
    confidenceScore: 70,
  };
}

async function chatWithAssistant(
  messages: ChatMessage[],
  context: { bankroll: number; strategies: string[]; xp: number },
): Promise<string> {
  try {
    const zai = await ZAI.create();

    const systemPrompt = `You are OTM Agent, an AI-powered bootstrapping assistant. You help users go from zero to funded.

USER CONTEXT:
- Bankroll: $${context.bankroll}
- Active Strategies: ${context.strategies.join(", ")}
- Experience Level: ${context.xp} XP

Your personality:
- Direct and actionable
- Encouraging but realistic
- Focused on speed-to-dollar
- Always provide specific, executable advice

Keep responses under 150 words. Use bullet points when listing steps.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-6), // Keep last 6 messages for context
      ],
      temperature: 0.8,
      max_tokens: 300,
      validate: true,
    });

    return (
      completion.choices[0]?.message?.content ||
      "I'm here to help. What would you like to know about building your income?"
    );
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}

async function generateSchedule(params: {
  hoursAvailable: number;
  bankroll: number;
  preferences: string[];
}): Promise<{
  schedule: Array<{ time: string; task: string; duration: number; priority: string }>;
}> {
  try {
    const zai = await ZAI.create();

    const prompt = `Create an optimal daily schedule for someone with $${params.bankroll} who has ${params.hoursAvailable} hours available today.

Their preferred strategies are: ${params.preferences.join(", ") || "Not specified"}

Create a JSON schedule with 3-5 time blocks. Each block should have:
- time: e.g., "9:00 AM"
- task: specific action to take
- duration: minutes (15-120)
- priority: "high", "medium", or "low"

Focus on speed-to-dollar activities. Respond ONLY with valid JSON: { "schedule": [...] }`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a productivity AI. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return getDefaultSchedule(params.hoursAvailable);
  } catch (error) {
    console.error("Schedule generation error:", error);
    return getDefaultSchedule(params.hoursAvailable);
  }
}

function getDefaultSchedule(hours: number): {
  schedule: Array<{ time: string; task: string; duration: number; priority: string }>;
} {
  const tasks = [
    {
      time: "9:00 AM",
      task: "Complete micro-tasks on Clickworker/Scale AI",
      duration: Math.min(90, hours * 30),
      priority: "high",
    },
    {
      time: "11:00 AM",
      task: "Check and respond to Fiverr/Upwork inquiries",
      duration: 30,
      priority: "high",
    },
    {
      time: "11:30 AM",
      task: "Create content for content arbitrage",
      duration: Math.min(60, hours * 20),
      priority: "medium",
    },
    { time: "1:00 PM", task: "Break for lunch", duration: 30, priority: "low" },
    {
      time: "1:30 PM",
      task: "Cold outreach for automation services",
      duration: Math.min(45, hours * 15),
      priority: "medium",
    },
  ];

  return { schedule: tasks.slice(0, Math.max(3, Math.ceil(hours))) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "analyze": {
        const analysis = await analyzeOpportunity(data);
        return NextResponse.json({ success: true, analysis });
      }

      case "chat": {
        const response = await chatWithAssistant(data.messages, data.context);
        return NextResponse.json({ success: true, response });
      }

      case "schedule": {
        const schedule = await generateSchedule(data);
        return NextResponse.json({ success: true, ...schedule });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
