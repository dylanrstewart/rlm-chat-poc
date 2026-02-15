import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

interface ReplLogPanelProps {
  compact?: boolean;
}

export function ReplLogPanel({ compact }: ReplLogPanelProps) {
  const { replSteps } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replSteps]);

  if (compact) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-1 t-border-b flex items-center">
          <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
            System Activity Log
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          {replSteps.length === 0 && (
            <p className="text-sm text-terminal-amber-dim font-mono">
              &gt; AWAITING SYSTEM ACTIVITY...
            </p>
          )}
          {replSteps.map((step, i) => (
            <div key={i} className="text-sm font-mono">
              <span className="text-terminal-amber-dim">
                [{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}]
              </span>{" "}
              <span className="text-terminal-amber">
                ITER_{step.iteration}: EXEC {step.code.split("\n")[0].substring(0, 60)}
                {step.code.split("\n")[0].length > 60 ? "..." : ""}
              </span>
              {step.has_answer && (
                <span className="text-terminal-amber-bright text-glow ml-2">
                  [SUBMIT]
                </span>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>
    );
  }

  // Full view (when System Logs tab is active)
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 t-border-b">
        <span className="text-sm text-terminal-amber-bright text-glow uppercase tracking-wider">
          &gt; System Execution Logs
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {replSteps.length === 0 && (
          <p className="text-sm text-terminal-amber-dim font-mono text-center mt-10">
            &gt; NO EXECUTION LOGS RECORDED THIS SESSION.
            <br />
            &gt; SEND A QUERY TO BEGIN REPL OPERATIONS...
          </p>
        )}
        {replSteps.map((step, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-terminal-amber-bright text-glow">
                ITERATION_{step.iteration}
              </span>
              {step.has_answer && (
                <span className="text-sm font-mono t-border px-2 py-0.5 text-terminal-amber-bright bg-terminal-amber-faint text-glow">
                  SUBMIT
                </span>
              )}
            </div>
            <div className="t-border p-2 bg-terminal-dark overflow-x-auto">
              <pre className="text-sm text-terminal-amber whitespace-pre-wrap font-mono">
                {step.code}
              </pre>
            </div>
            {step.output && (
              <div className="p-2 bg-terminal-dark overflow-x-auto" style={{ borderLeft: '2px solid #8a6a10' }}>
                <pre className="text-sm text-terminal-amber-dim whitespace-pre-wrap font-mono">
                  {step.output}
                </pre>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
