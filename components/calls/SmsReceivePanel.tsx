"use client";

import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";

interface DemoMessage {
  id: string;
  body: string;
  created_at: string;
}

/**
 * After the speed-to-lead call ends, the homeowner's phone stays open and
 * "receives" the confirmation SMS once the team approves and simulate-sends
 * it from the Inbox. Polls a public, read-limited endpoint for that lead's
 * simulated-sent messages.
 */
export function SmsReceivePanel({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<DemoMessage[]>([]);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/demo/messages?lead=${leadId}`);
        if (res.ok && active) {
          const data = (await res.json()) as { messages: DemoMessage[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        // Polling failure is non-fatal; try again next tick.
      }
    }
    void poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [leadId]);

  return (
    <div className="mt-1 rounded-xl bg-white/5 p-3 text-left">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">
        <MessageSquareText className="h-3 w-3" />
        Messages
      </p>
      {messages.length === 0 ? (
        <p className="text-xs text-white/40">
          Waiting for the team to approve the confirmation text… (approve &amp; simulate-send it in
          the Command Center Inbox and it&apos;ll arrive here)
        </p>
      ) : (
        <div className="space-y-1.5">
          {messages.map((msg) => (
            <div key={msg.id} className="max-w-[95%] rounded-2xl rounded-bl-sm bg-white/15 px-3 py-2">
              <p className="text-xs leading-relaxed text-white/90">{msg.body}</p>
              <p className="mt-1 text-[10px] text-white/40">
                Northstar Exterior &amp; Home ·{" "}
                {new Date(msg.created_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
