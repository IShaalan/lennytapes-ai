/**
 * RAGAS Evaluation Wrapper
 *
 * Calls the Python RAGAS script via subprocess.
 */

import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import type { RagasInput, RagasScores, RagasEvaluationResult } from "./types";
import { RAGAS_THRESHOLDS } from "./types";

const PYTHON_SCRIPT_PATH = join(process.cwd(), "scripts/python/ragas_eval.py");
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
// Use venv Python if available, otherwise fall back to system Python
const VENV_PYTHON_PATH = join(process.cwd(), ".venv/bin/python3");

interface EvaluateOptions {
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Python executable to use (default: venv Python if available, else "python3") */
  pythonPath?: string;
}

/**
 * Get the Python executable path.
 * Prefers the virtual environment Python if it exists.
 */
function getPythonPath(): string {
  if (existsSync(VENV_PYTHON_PATH)) {
    return VENV_PYTHON_PATH;
  }
  return "python3";
}

/**
 * Run RAGAS evaluation on a single sample.
 *
 * @param input - The question, answer, and contexts to evaluate
 * @param options - Optional configuration
 * @returns RAGAS scores and metadata
 *
 * @example
 * ```ts
 * const result = await evaluateWithRagas({
 *   question: "What is product-led growth?",
 *   answer: "Product-led growth is a strategy where...",
 *   contexts: ["In the podcast, Lenny explains that PLG..."]
 * });
 * console.log(result.scores.faithfulness); // 0.92
 * ```
 */
export async function evaluateWithRagas(
  input: RagasInput,
  options: EvaluateOptions = {}
): Promise<RagasEvaluationResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, pythonPath = getPythonPath() } = options;
  const startTime = Date.now();

  try {
    const scores = await runPythonScript(input, pythonPath, timeoutMs);
    const durationMs = Date.now() - startTime;

    const passed = checkThresholds(scores);

    return {
      input,
      scores,
      durationMs,
      passed,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      input,
      scores: {
        faithfulness: null,
        answer_relevancy: null,
        context_precision: null,
        error: errorMessage,
      },
      durationMs,
      passed: false,
    };
  }
}

/**
 * Run the Python RAGAS script via subprocess.
 */
async function runPythonScript(
  input: RagasInput,
  pythonPath: string,
  timeoutMs: number
): Promise<RagasScores> {
  return new Promise((resolve, reject) => {
    const process = spawn(pythonPath, [PYTHON_SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...globalThis.process.env,
        // Gemini (preferred for embeddings, matches app)
        GEMINI_API_KEY: globalThis.process.env.GEMINI_API_KEY,
        // Azure OpenAI (for LLM judge)
        AZURE_OPENAI_API_KEY: globalThis.process.env.AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_ENDPOINT: globalThis.process.env.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_DEPLOYMENT: globalThis.process.env.AZURE_OPENAI_DEPLOYMENT,
        AZURE_OPENAI_API_VERSION: globalThis.process.env.AZURE_OPENAI_API_VERSION,
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: globalThis.process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        // Fallback to direct OpenAI
        OPENAI_API_KEY: globalThis.process.env.OPENAI_API_KEY,
      },
    });

    let stdout = "";
    let stderr = "";

    // Set timeout
    const timeout = setTimeout(() => {
      process.kill("SIGTERM");
      reject(new Error(`RAGAS evaluation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Collect stdout
    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    process.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0 && !stdout) {
        reject(new Error(`RAGAS script failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as RagasScores;

        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse RAGAS output: ${stdout}`));
      }
    });

    // Handle spawn errors
    process.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });

    // Send input to stdin
    process.stdin.write(JSON.stringify(input));
    process.stdin.end();
  });
}

/**
 * Check if all scores meet the target thresholds.
 */
function checkThresholds(scores: RagasScores): boolean {
  if (scores.error) return false;

  const { faithfulness, answer_relevancy, context_precision } = scores;

  if (faithfulness === null || answer_relevancy === null || context_precision === null) {
    return false;
  }

  return (
    faithfulness >= RAGAS_THRESHOLDS.faithfulness &&
    answer_relevancy >= RAGAS_THRESHOLDS.answer_relevancy &&
    context_precision >= RAGAS_THRESHOLDS.context_precision
  );
}

/**
 * Batch evaluate multiple samples.
 *
 * @param inputs - Array of inputs to evaluate
 * @param options - Optional configuration
 * @returns Array of evaluation results
 */
export async function evaluateBatch(
  inputs: RagasInput[],
  options: EvaluateOptions & { concurrency?: number } = {}
): Promise<RagasEvaluationResult[]> {
  const { concurrency = 3, ...evalOptions } = options;
  const results: RagasEvaluationResult[] = [];

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((input) => evaluateWithRagas(input, evalOptions))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate aggregate metrics from multiple evaluation results.
 */
export function aggregateResults(results: RagasEvaluationResult[]): {
  count: number;
  passed: number;
  failed: number;
  passRate: number;
  averages: {
    faithfulness: number;
    answer_relevancy: number;
    context_precision: number;
  };
} {
  const validResults = results.filter((r) => !r.scores.error);
  const passedResults = validResults.filter((r) => r.passed);

  const sum = validResults.reduce(
    (acc, r) => ({
      faithfulness: acc.faithfulness + (r.scores.faithfulness ?? 0),
      answer_relevancy: acc.answer_relevancy + (r.scores.answer_relevancy ?? 0),
      context_precision: acc.context_precision + (r.scores.context_precision ?? 0),
    }),
    { faithfulness: 0, answer_relevancy: 0, context_precision: 0 }
  );

  const count = validResults.length;

  return {
    count: results.length,
    passed: passedResults.length,
    failed: results.length - passedResults.length,
    passRate: count > 0 ? passedResults.length / count : 0,
    averages: {
      faithfulness: count > 0 ? sum.faithfulness / count : 0,
      answer_relevancy: count > 0 ? sum.answer_relevancy / count : 0,
      context_precision: count > 0 ? sum.context_precision / count : 0,
    },
  };
}
