import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function ReplLogPanel() {
  const { replSteps } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replSteps]);

  return (
    <aside className="bg-gray-900 text-gray-100 flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          REPL Log
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {replSteps.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-10">
            REPL steps will appear here as the RLM executes code
          </p>
        )}
        {replSteps.map((step, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400">
                Iteration {step.iteration}
              </span>
              {step.has_answer && (
                <span className="text-xs bg-green-800 text-green-200 px-1.5 py-0.5 rounded">
                  SUBMIT
                </span>
              )}
            </div>
            <div className="bg-gray-800 rounded p-2 overflow-x-auto">
              <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono">
                {step.code}
              </pre>
            </div>
            {step.output && (
              <div className="bg-gray-800 rounded p-2 overflow-x-auto border-l-2 border-yellow-600">
                <pre className="text-xs text-yellow-200 whitespace-pre-wrap font-mono">
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
