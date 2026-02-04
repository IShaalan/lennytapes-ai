/**
 * RAGAS Evaluation Types
 */

export interface RagasInput {
  /** The user's question */
  question: string;
  /** The generated answer from the RAG system */
  answer: string;
  /** The retrieved context chunks used to generate the answer */
  contexts: string[];
}

export interface RagasScores {
  /**
   * Faithfulness: Is the answer grounded in the retrieved context?
   * Range: 0.0 to 1.0 (higher is better)
   * Target: > 0.85
   */
  faithfulness: number | null;

  /**
   * Answer Relevancy: Does the answer address the question?
   * Range: 0.0 to 1.0 (higher is better)
   * Target: > 0.80
   */
  answer_relevancy: number | null;

  /**
   * Context Precision: Are the retrieved documents relevant to the question?
   * Range: 0.0 to 1.0 (higher is better)
   * Target: > 0.75
   */
  context_precision: number | null;

  /** Error message if evaluation failed */
  error: string | null;
}

export interface RagasEvaluationResult {
  /** Input that was evaluated */
  input: RagasInput;
  /** Scores from RAGAS */
  scores: RagasScores;
  /** Evaluation duration in milliseconds */
  durationMs: number;
  /** Whether all scores meet thresholds */
  passed: boolean;
}

export const RAGAS_THRESHOLDS = {
  faithfulness: 0.85,
  answer_relevancy: 0.80,
  context_precision: 0.75,
} as const;

export const RAGAS_ALERT_THRESHOLDS = {
  faithfulness: 0.70,
  answer_relevancy: 0.65,
  context_precision: 0.60,
} as const;
