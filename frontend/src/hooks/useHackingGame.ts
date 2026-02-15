import { useReducer, useCallback } from "react";
import {
  WORD_LISTS,
  DIFFICULTY_CONFIG,
  type Difficulty,
} from "../data/hackingWords";

// ── Types ───────────────────────────────────────────────

export type GamePhase = "idle" | "playing" | "won" | "lost";

export interface CharCell {
  char: string;
  wordId: string | null;
  bracketGroupId: string | null;
}

export interface HexLine {
  address: string;
  chars: CharCell[];
}

export interface GuessResult {
  word: string;
  likeness: number;
}

interface GameState {
  phase: GamePhase;
  difficulty: Difficulty;
  attemptsLeft: number;
  leftColumn: HexLine[];
  rightColumn: HexLine[];
  guessHistory: GuessResult[];
  hoveredWordId: string | null;
  hoveredBracketId: string | null;
  feedbackLog: string[];
  correctWord: string;
  wordLength: number;
  removedWordIds: Set<string>;
}

// ── Actions ─────────────────────────────────────────────

type Action =
  | { type: "START_GAME"; difficulty: Difficulty }
  | { type: "GUESS_WORD"; wordId: string }
  | { type: "BRACKET_TRICK"; bracketGroupId: string }
  | { type: "HOVER"; wordId: string | null; bracketId: string | null }
  | { type: "RESET" };

// ── Helpers ─────────────────────────────────────────────

const CHARS_PER_LINE = 16;
const LINES_PER_COLUMN = 20;
const TOTAL_LINES = LINES_PER_COLUMN * 2;
const GARBAGE_CHARS = "!@#$%^&*()_+-={}[]|;:'\"<>,.?/~".split("");
const BRACKET_PAIRS: [string, string][] = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["<", ">"],
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sampleN<T>(arr: readonly T[], n: number): T[] {
  return shuffle([...arr]).slice(0, n);
}

function randomGarbage(): string {
  return pickRandom(GARBAGE_CHARS);
}

function computeLikeness(guess: string, answer: string): number {
  let count = 0;
  for (let i = 0; i < Math.min(guess.length, answer.length); i++) {
    if (guess[i] === answer[i]) count++;
  }
  return count;
}

// ── Puzzle Generation ───────────────────────────────────

interface PuzzleData {
  leftColumn: HexLine[];
  rightColumn: HexLine[];
  correctWord: string;
  wordLength: number;
  wordMap: Map<string, string>; // wordId -> word text
}

function generatePuzzle(difficulty: Difficulty): PuzzleData {
  const config = DIFFICULTY_CONFIG[difficulty];

  // Pick word length
  const wordLength =
    typeof config.wordLength === "number"
      ? config.wordLength
      : randInt(config.wordLength[0], config.wordLength[1]);

  // Sample words
  const available = WORD_LISTS[wordLength] ?? WORD_LISTS[4];
  const wordCount = randInt(config.wordCount[0], config.wordCount[1]);
  const words = sampleN(available, Math.min(wordCount, available.length));
  const correctWord = pickRandom(words);

  // Build flat grid of CharCells
  const totalSlots = TOTAL_LINES * CHARS_PER_LINE;
  const grid: CharCell[] = Array.from({ length: totalSlots }, () => ({
    char: randomGarbage(),
    wordId: null,
    bracketGroupId: null,
  }));

  // Place words — at most 1 per line
  const wordMap = new Map<string, string>();
  const lineIndices = shuffle(
    Array.from({ length: TOTAL_LINES }, (_, i) => i),
  );

  for (let wi = 0; wi < words.length && wi < lineIndices.length; wi++) {
    const word = words[wi];
    const lineIdx = lineIndices[wi];
    const maxOffset = CHARS_PER_LINE - word.length;
    if (maxOffset < 0) continue;
    const offset = randInt(0, maxOffset);
    const wordId = `w${wi}`;
    wordMap.set(wordId, word);

    for (let ci = 0; ci < word.length; ci++) {
      const idx = lineIdx * CHARS_PER_LINE + offset + ci;
      grid[idx] = { char: word[ci], wordId, bracketGroupId: null };
    }
  }

  // Inject bracket tricks in garbage-only regions
  const bracketCount = randInt(6, 12);
  let bracketId = 0;

  for (let b = 0; b < bracketCount; b++) {
    const [opener, closer] = pickRandom(BRACKET_PAIRS);
    const innerLen = randInt(1, 5);
    const totalLen = innerLen + 2; // opener + inner + closer

    // Find a spot in the grid where all cells are garbage (no word, no bracket)
    const maxStart = totalSlots - totalLen;
    let attempts = 0;
    let placed = false;

    while (attempts < 50 && !placed) {
      const start = randInt(0, maxStart);
      // Must be on the same line
      const startLine = Math.floor(start / CHARS_PER_LINE);
      const endLine = Math.floor((start + totalLen - 1) / CHARS_PER_LINE);
      if (startLine !== endLine) {
        attempts++;
        continue;
      }

      let allGarbage = true;
      for (let i = start; i < start + totalLen; i++) {
        if (grid[i].wordId !== null || grid[i].bracketGroupId !== null) {
          allGarbage = false;
          break;
        }
      }

      if (allGarbage) {
        const bgId = `b${bracketId++}`;
        grid[start] = { char: opener, wordId: null, bracketGroupId: bgId };
        for (let i = 1; i <= innerLen; i++) {
          grid[start + i] = {
            char: randomGarbage(),
            wordId: null,
            bracketGroupId: bgId,
          };
        }
        grid[start + totalLen - 1] = {
          char: closer,
          wordId: null,
          bracketGroupId: bgId,
        };
        placed = true;
      }
      attempts++;
    }
  }

  // Generate hex addresses
  const baseAddr = randInt(0xf000, 0xff00);
  const allLines: HexLine[] = [];

  for (let i = 0; i < TOTAL_LINES; i++) {
    const addr = baseAddr + i * 0x10;
    const address = "0x" + addr.toString(16).toUpperCase().padStart(4, "0");
    const chars = grid.slice(i * CHARS_PER_LINE, (i + 1) * CHARS_PER_LINE);
    allLines.push({ address, chars });
  }

  return {
    leftColumn: allLines.slice(0, LINES_PER_COLUMN),
    rightColumn: allLines.slice(LINES_PER_COLUMN),
    correctWord,
    wordLength,
    wordMap,
  };
}

// ── Reducer ─────────────────────────────────────────────

const initialState: GameState = {
  phase: "idle",
  difficulty: "novice",
  attemptsLeft: 4,
  leftColumn: [],
  rightColumn: [],
  guessHistory: [],
  hoveredWordId: null,
  hoveredBracketId: null,
  feedbackLog: [],
  correctWord: "",
  wordLength: 4,
  removedWordIds: new Set(),
};

function findWordText(
  columns: HexLine[][],
  wordId: string,
): string {
  for (const col of columns) {
    for (const line of col) {
      const chars = line.chars
        .filter((c) => c.wordId === wordId)
        .map((c) => c.char);
      if (chars.length > 0) return chars.join("");
    }
  }
  return "";
}

function findAllWordIds(columns: HexLine[][]): string[] {
  const ids = new Set<string>();
  for (const col of columns) {
    for (const line of col) {
      for (const c of line.chars) {
        if (c.wordId) ids.add(c.wordId);
      }
    }
  }
  return [...ids];
}

function removeDudWord(
  columns: HexLine[][],
  wordIdToRemove: string,
): HexLine[][] {
  return columns.map((col) =>
    col.map((line) => ({
      ...line,
      chars: line.chars.map((c) =>
        c.wordId === wordIdToRemove
          ? { char: ".", wordId: null, bracketGroupId: null }
          : c,
      ),
    })),
  );
}

function removeBracketGroup(
  columns: HexLine[][],
  bracketGroupId: string,
): HexLine[][] {
  return columns.map((col) =>
    col.map((line) => ({
      ...line,
      chars: line.chars.map((c) =>
        c.bracketGroupId === bracketGroupId
          ? { ...c, bracketGroupId: null }
          : c,
      ),
    })),
  );
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START_GAME": {
      const puzzle = generatePuzzle(action.difficulty);
      return {
        ...initialState,
        phase: "playing",
        difficulty: action.difficulty,
        attemptsLeft: 4,
        leftColumn: puzzle.leftColumn,
        rightColumn: puzzle.rightColumn,
        correctWord: puzzle.correctWord,
        wordLength: puzzle.wordLength,
        feedbackLog: [],
        guessHistory: [],
        removedWordIds: new Set(),
      };
    }

    case "GUESS_WORD": {
      if (state.phase !== "playing") return state;

      const word = findWordText(
        [state.leftColumn, state.rightColumn],
        action.wordId,
      );
      if (!word) return state;

      // Already guessed this word
      if (state.guessHistory.some((g) => g.word === word)) return state;

      const likeness = computeLikeness(word, state.correctWord);
      const result: GuessResult = { word, likeness };
      const newHistory = [...state.guessHistory, result];

      if (word === state.correctWord) {
        return {
          ...state,
          phase: "won",
          guessHistory: newHistory,
          feedbackLog: [
            ...state.feedbackLog,
            `>${word}`,
            ">Exact match!",
            ">Please wait",
            ">while system",
            ">is accessed.",
          ],
          hoveredWordId: null,
          hoveredBracketId: null,
        };
      }

      const attemptsLeft = state.attemptsLeft - 1;
      if (attemptsLeft <= 0) {
        return {
          ...state,
          phase: "lost",
          attemptsLeft: 0,
          guessHistory: newHistory,
          feedbackLog: [
            ...state.feedbackLog,
            `>${word}`,
            ">Entry denied.",
            `>Likeness=${likeness}`,
            ">TERMINAL LOCKED",
            `>Password was: ${state.correctWord}`,
          ],
          hoveredWordId: null,
          hoveredBracketId: null,
        };
      }

      return {
        ...state,
        attemptsLeft,
        guessHistory: newHistory,
        feedbackLog: [
          ...state.feedbackLog,
          `>${word}`,
          ">Entry denied.",
          `>Likeness=${likeness}`,
        ],
      };
    }

    case "BRACKET_TRICK": {
      if (state.phase !== "playing") return state;

      const columns: HexLine[][] = [state.leftColumn, state.rightColumn];

      // Remove the bracket group so it can't be clicked again
      const clearedColumns = removeBracketGroup(
        columns,
        action.bracketGroupId,
      );

      // 40% chance: reset tries
      if (Math.random() < 0.4) {
        return {
          ...state,
          leftColumn: clearedColumns[0],
          rightColumn: clearedColumns[1],
          attemptsLeft: 4,
          feedbackLog: [...state.feedbackLog, ">Tries reset."],
        };
      }

      // 60% chance: remove a dud word
      const allWordIds = findAllWordIds(clearedColumns);
      const correctWordId = allWordIds.find((id) => {
        const text = findWordText(clearedColumns, id);
        return text === state.correctWord;
      });
      const dudIds = allWordIds.filter(
        (id) => id !== correctWordId && !state.removedWordIds.has(id),
      );

      if (dudIds.length === 0) {
        // No duds to remove — reset tries instead
        return {
          ...state,
          leftColumn: clearedColumns[0],
          rightColumn: clearedColumns[1],
          attemptsLeft: 4,
          feedbackLog: [...state.feedbackLog, ">Tries reset."],
        };
      }

      const dudToRemove = pickRandom(dudIds);
      const finalColumns = removeDudWord(clearedColumns, dudToRemove);

      return {
        ...state,
        leftColumn: finalColumns[0],
        rightColumn: finalColumns[1],
        removedWordIds: new Set([...state.removedWordIds, dudToRemove]),
        feedbackLog: [...state.feedbackLog, ">Dud removed."],
      };
    }

    case "HOVER":
      return {
        ...state,
        hoveredWordId: action.wordId,
        hoveredBracketId: action.bracketId,
      };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────

export interface HackingActions {
  startGame: (difficulty: Difficulty) => void;
  clickCell: (cell: CharCell) => "word" | "bracket" | "none";
  hoverCell: (cell: CharCell | null) => void;
  resetGame: () => void;
}

export function useHackingGame(): [GameState, HackingActions] {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startGame = useCallback((difficulty: Difficulty) => {
    dispatch({ type: "START_GAME", difficulty });
  }, []);

  const clickCell = useCallback(
    (cell: CharCell): "word" | "bracket" | "none" => {
      if (cell.wordId && !state.removedWordIds.has(cell.wordId)) {
        dispatch({ type: "GUESS_WORD", wordId: cell.wordId });
        return "word";
      }
      if (cell.bracketGroupId) {
        dispatch({ type: "BRACKET_TRICK", bracketGroupId: cell.bracketGroupId });
        return "bracket";
      }
      return "none";
    },
    [state.removedWordIds],
  );

  const hoverCell = useCallback((cell: CharCell | null) => {
    dispatch({
      type: "HOVER",
      wordId: cell?.wordId ?? null,
      bracketId: cell?.bracketGroupId ?? null,
    });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return [state, { startGame, clickCell, hoverCell, resetGame }];
}
