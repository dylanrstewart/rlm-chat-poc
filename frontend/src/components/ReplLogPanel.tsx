import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function ReplLogPanel() {
  const { replSteps } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replSteps]);

  return (
    <aside className="bg-cyber-deep flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-cyber-green/20">
        <h2 className="text-xs font-orbitron font-bold uppercase tracking-widest text-cyber-green text-glow-cyan">
          Exec Log
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {replSteps.length === 0 && (
          <p className="text-cyber-muted text-xs text-center mt-10 font-mono">
            &gt; awaiting code execution...
          </p>
        )}
        {replSteps.map((step, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyber-cyan font-mono">
                iter_{step.iteration}
              </span>
              {step.has_answer && (
                <span className="text-xs bg-cyber-green/20 text-cyber-green border border-cyber-green/40 px-2 py-0.5 rounded font-mono glow-green">
                  SUBMIT
                </span>
              )}
            </div>
            <div className="bg-cyber-surface rounded p-2 overflow-x-auto border border-cyber-green/10">
              <pre className="text-xs text-cyber-green whitespace-pre-wrap font-mono">
                {step.code}
              </pre>
            </div>
            {step.output && (
              <div className="bg-cyber-surface rounded p-2 overflow-x-auto border-l-2 border-cyber-amber">
                <pre className="text-xs text-cyber-amber whitespace-pre-wrap font-mono">
                  {step.output}
                </pre>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </aside>
  );
}
