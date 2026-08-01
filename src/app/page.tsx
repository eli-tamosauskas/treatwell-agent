"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-sm font-semibold tracking-tight">
          Availability chat
        </h1>
        <p className="text-xs text-zinc-500">
          Ask what&apos;s free — e.g. &ldquo;anything Friday for makeup?&rdquo;
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400">
            No messages yet. Ask about your calendar to get started.
          </p>
        )}

        {messages.map((message) => (
          <div key={message.id} className="text-sm">
            <div className="mb-1 text-xs font-medium text-zinc-500">
              {message.role === "user" ? "You" : "Assistant"}
            </div>
            <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return <div key={`${message.id}-${i}`}>{part.text}</div>;
                  case "tool-findAvailability":
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        {part.state === "output-available"
                          ? "Checked availability."
                          : "Checking availability…"}
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        className="border-t border-zinc-200 p-4 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          className="w-full rounded-full border border-zinc-300 px-4 py-2 text-sm shadow-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          value={input}
          placeholder="Ask about your availability…"
          onChange={(e) => setInput(e.currentTarget.value)}
          disabled={busy}
        />
      </form>
    </div>
  );
}
