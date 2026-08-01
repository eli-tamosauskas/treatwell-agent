import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { aiGatewayApiKey } from "@/lib/env";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { venueLocalToday } from "@/lib/venue-time";
import { findAvailabilityTool } from "@/lib/find-availability-tool";

/**
 * Model reference for the Vercel AI Gateway, as a swappable `provider/model`
 * string (PRD user story 19). Defaults to a cheap Flash-class model to conserve
 * gateway credit; override with `CHAT_MODEL` without touching code.
 */
const CHAT_MODEL = process.env.CHAT_MODEL ?? "openai/gpt-5-nano";

export async function POST(req: Request) {
  // Fail loudly and early if the gateway key is missing.
  aiGatewayApiKey();

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system: buildSystemPrompt(venueLocalToday(new Date())),
    messages: await convertToModelMessages(messages),
    // Let the model call the tool and then narrate the result in one turn.
    stopWhen: isStepCount(5),
    tools: {
      findAvailability: findAvailabilityTool,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
