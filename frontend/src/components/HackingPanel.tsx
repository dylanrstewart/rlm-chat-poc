import { useRef, useCallback, useEffect, useState } from "react";
import { useHackingGame, type CharCell, type HexLine } from "../hooks/useHackingGame";
import { DIFFICULTY_CONFIG, type Difficulty } from "../data/hackingWords";
import { useSound } from "../audio/useSound";

const DIFFICULTIES: Difficulty[] = ["novice", "advanced", "expert", "master"];

export function HackingPanel() {
  const [state, actions] = useHackingGame();
  const { play } = useSound();
  const lastHoverSound = useRef(0);

  const playThrottled = useCallback(
    (type: "keystroke") => {
      const now = Date.now();
      if (now - lastHoverSound.current > 80) {
        play(type);
        lastHoverSound.current = now;
      }
    },
    [play],
  );

  const handleCellHover = useCallback(
    (cell: CharCell | null) => {
      if (cell && (cell.wordId || cell.bracketGroupId)) {
        playThrottled("keystroke");
      }
      actions.hoverCell(cell);
    },
    [actions, playThrottled],
  );

  const handleCellClick = useCallback(
    (cell: CharCell) => {
      const result = actions.clickCell(cell);
      if (result === "word") {
        // Check if this guess won or lost (we read from latest feedback)
        // Sound is played after state update via effect
      } else if (result === "bracket") {
        play("tabClick");
      }
    },
    [actions, play],
  );

  // Play sounds on phase transitions
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      if (state.phase === "won") play("confirm");
      if (state.phase === "lost") play("error");
      prevPhaseRef.current = state.phase;
    }
  }, [state.phase, play]);

  // Play error on wrong guess (attempts decreased but still playing)
  const prevAttemptsRef = useRef(state.attemptsLeft);
  useEffect(() => {
    if (
      state.phase === "playing" &&
      prevAttemptsRef.current > state.attemptsLeft
    ) {
      play("error");
    }
    prevAttemptsRef.current = state.attemptsLeft;
  }, [state.attemptsLeft, state.phase, play]);

  const handleDifficultySelect = useCallback(
    (d: Difficulty) => {
      play("tabClick");
      actions.startGame(d);
    },
    [actions, play],
  );

  const handleNewPuzzle = useCallback(() => {
    play("tabClick");
    actions.resetGame();
  }, [actions, play]);

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <p className="text-terminal-amber-bright text-lg">
          {">"} ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL
        </p>
        <p className="text-terminal-amber-dim text-base mt-1">
          {">"} ENTER PASSWORD NOW
        </p>
      </div>

      {/* Main area */}
      <div className="flex-1 flex gap-10 overflow-hidden min-h-0 justify-center">
        {/* Left: hex dump or state screen */}
        <div className="overflow-auto font-mono text-base leading-7 select-none">
          {state.phase === "idle" && <IdleScreen onSelect={handleDifficultySelect} />}
          {state.phase === "playing" && (
            <HexDump
              leftColumn={state.leftColumn}
              rightColumn={state.rightColumn}
              hoveredWordId={state.hoveredWordId}
              hoveredBracketId={state.hoveredBracketId}
              removedWordIds={state.removedWordIds}
              onHover={handleCellHover}
              onClick={handleCellClick}
            />
          )}
          {state.phase === "won" && <ResultScreen type="won" />}
          {state.phase === "lost" && (
            <ResultScreen type="lost" correctWord={state.correctWord} />
          )}
        </div>

        {/* Right: attempts + feedback */}
        <div className="w-[300px] shrink-0 flex flex-col gap-4 overflow-hidden">
          <AttemptsDisplay count={state.attemptsLeft} phase={state.phase} />
          <FeedbackLog entries={state.feedbackLog} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-4 pt-3 shrink-0 flex items-center gap-4 border-t border-terminal-border">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => handleDifficultySelect(d)}
            className={`px-5 py-2 text-base uppercase border border-terminal-border
              hover:bg-terminal-amber-faint hover:text-terminal-amber-bright
              ${state.difficulty === d && state.phase !== "idle"
                ? "bg-terminal-amber-faint text-terminal-amber-bright"
                : "text-terminal-amber-dim"
              }`}
          >
            {DIFFICULTY_CONFIG[d].label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleNewPuzzle}
          className="px-5 py-2 text-base uppercase border border-terminal-border
            text-terminal-amber hover:bg-terminal-amber-faint hover:text-terminal-amber-bright"
        >
          New Puzzle
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function IdleScreen({ onSelect }: { onSelect: (d: Difficulty) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      <div className="text-center">
        <p className="text-terminal-amber-bright text-3xl mb-4">
          TERMINAL HACKING
        </p>
        <p className="text-terminal-amber-dim text-base">
          Select difficulty to begin
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className="px-10 py-3 text-lg uppercase border border-terminal-border
              text-terminal-amber hover:bg-terminal-amber-faint
              hover:text-terminal-amber-bright transition-colors"
          >
            {DIFFICULTY_CONFIG[d].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultScreen({
  type,
  correctWord,
}: {
  type: "won" | "lost";
  correctWord?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p
        className={`text-4xl font-bold transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        } ${type === "won" ? "text-terminal-amber-bright" : "text-red-500"}`}
      >
        {type === "won" ? "ACCESS GRANTED" : "TERMINAL LOCKED"}
      </p>
      {type === "lost" && correctWord && (
        <p className="text-terminal-amber-dim text-base mt-2">
          Password was: {correctWord}
        </p>
      )}
    </div>
  );
}

function AttemptsDisplay({
  count,
  phase,
}: {
  count: number;
  phase: string;
}) {
  return (
    <div className="shrink-0">
      <p className="text-terminal-amber text-base mb-2">
        {">"} {count} ATTEMPT(S) LEFT
      </p>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={`text-2xl ${
              i < count
                ? phase === "won"
                  ? "text-terminal-amber-bright"
                  : "text-terminal-amber"
                : "text-terminal-amber-dim"
            }`}
          >
            {i < count ? "\u25A0" : "\u25A1"}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedbackLog({ entries }: { entries: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto font-mono text-base leading-7 min-h-0"
    >
      {entries.map((entry, i) => (
        <p
          key={i}
          className={
            entry.includes("denied") || entry.includes("LOCKED")
              ? "text-red-400"
              : entry.includes("match") || entry.includes("accessed")
                ? "text-terminal-amber-bright"
                : "text-terminal-amber-dim"
          }
        >
          {entry}
        </p>
      ))}
    </div>
  );
}

// ── Hex Dump ────────────────────────────────────────────

function HexDump({
  leftColumn,
  rightColumn,
  hoveredWordId,
  hoveredBracketId,
  removedWordIds,
  onHover,
  onClick,
}: {
  leftColumn: HexLine[];
  rightColumn: HexLine[];
  hoveredWordId: string | null;
  hoveredBracketId: string | null;
  removedWordIds: Set<string>;
  onHover: (cell: CharCell | null) => void;
  onClick: (cell: CharCell) => void;
}) {
  return (
    <div className="flex gap-10">
      <HexColumn
        lines={leftColumn}
        hoveredWordId={hoveredWordId}
        hoveredBracketId={hoveredBracketId}
        removedWordIds={removedWordIds}
        onHover={onHover}
        onClick={onClick}
      />
      <HexColumn
        lines={rightColumn}
        hoveredWordId={hoveredWordId}
        hoveredBracketId={hoveredBracketId}
        removedWordIds={removedWordIds}
        onHover={onHover}
        onClick={onClick}
      />
    </div>
  );
}

function HexColumn({
  lines,
  hoveredWordId,
  hoveredBracketId,
  removedWordIds,
  onHover,
  onClick,
}: {
  lines: HexLine[];
  hoveredWordId: string | null;
  hoveredBracketId: string | null;
  removedWordIds: Set<string>;
  onHover: (cell: CharCell | null) => void;
  onClick: (cell: CharCell) => void;
}) {
  return (
    <div>
      {lines.map((line, li) => (
        <div key={li} className="flex whitespace-nowrap">
          <span className="text-terminal-amber-dim mr-4">{line.address}</span>
          {line.chars.map((cell, ci) => (
            <CharSpan
              key={ci}
              cell={cell}
              hoveredWordId={hoveredWordId}
              hoveredBracketId={hoveredBracketId}
              removedWordIds={removedWordIds}
              onHover={onHover}
              onClick={onClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CharSpan({
  cell,
  hoveredWordId,
  hoveredBracketId,
  removedWordIds,
  onHover,
  onClick,
}: {
  cell: CharCell;
  hoveredWordId: string | null;
  hoveredBracketId: string | null;
  removedWordIds: Set<string>;
  onHover: (cell: CharCell | null) => void;
  onClick: (cell: CharCell) => void;
}) {
  const isWord = cell.wordId !== null && !removedWordIds.has(cell.wordId);
  const isBracket = cell.bracketGroupId !== null;
  const isHoveredWord = isWord && cell.wordId === hoveredWordId;
  const isHoveredBracket = isBracket && cell.bracketGroupId === hoveredBracketId;
  const isHighlighted = isHoveredWord || isHoveredBracket;

  let className = "inline-block w-[0.62em] text-center ";
  if (isHighlighted) {
    className += "text-terminal-amber-bright bg-terminal-amber-faint cursor-pointer";
  } else if (isWord) {
    className += "text-terminal-amber cursor-pointer";
  } else if (isBracket) {
    className += "text-terminal-amber cursor-pointer";
  } else {
    className += "text-terminal-amber-dim";
  }

  return (
    <span
      className={className}
      onMouseEnter={() => onHover(cell)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(cell)}
    >
      {cell.char}
    </span>
  );
}
