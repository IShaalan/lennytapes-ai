#!/usr/bin/env python3
"""
RAGAS Evaluation Script

Accepts JSON input via stdin and outputs RAGAS scores as JSON.
Supports both Azure OpenAI and direct OpenAI.

Input format:
{
    "question": "user question",
    "answer": "generated answer",
    "contexts": ["context chunk 1", "context chunk 2", ...]
}

Output format:
{
    "faithfulness": 0.85,
    "answer_relevancy": 0.90,
    "context_utilization": 0.75,
    "error": null
}

Environment variables:
    Azure OpenAI (preferred):
        AZURE_OPENAI_API_KEY
        AZURE_OPENAI_ENDPOINT
        AZURE_OPENAI_DEPLOYMENT
        AZURE_OPENAI_API_VERSION (optional, defaults to 2024-05-01-preview)

    Direct OpenAI (fallback):
        OPENAI_API_KEY

Usage:
    echo '{"question":"...","answer":"...","contexts":["..."]}' | python ragas_eval.py
"""

import json
import sys
import os
import warnings

# Suppress deprecation warnings for cleaner output
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)


def get_llm():
    """Get the LLM instance based on available environment variables."""
    # Check for Azure OpenAI first
    azure_key = os.environ.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    azure_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")

    if azure_key and azure_endpoint and azure_deployment:
        from langchain_openai import AzureChatOpenAI

        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")

        return AzureChatOpenAI(
            azure_endpoint=azure_endpoint,
            azure_deployment=azure_deployment,
            api_key=azure_key,
            api_version=api_version,
            temperature=0,
        )

    # Fallback to direct OpenAI
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            api_key=openai_key,
            model="gpt-4o-mini",
            temperature=0,
        )

    raise ValueError(
        "No LLM credentials found. Set either AZURE_OPENAI_* or OPENAI_API_KEY environment variables."
    )


def get_embeddings():
    """Get the embeddings instance based on available environment variables."""
    # Check for Gemini first (preferred, matches app embeddings)
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        return GoogleGenerativeAIEmbeddings(
            google_api_key=gemini_key,
            model="models/text-embedding-004",
        )

    # Check for Azure OpenAI embeddings
    azure_key = os.environ.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    azure_embedding_deployment = os.environ.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

    if azure_key and azure_endpoint and azure_embedding_deployment:
        from langchain_openai import AzureOpenAIEmbeddings

        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")

        return AzureOpenAIEmbeddings(
            azure_endpoint=azure_endpoint,
            azure_deployment=azure_embedding_deployment,
            api_key=azure_key,
            api_version=api_version,
        )

    # Fallback to direct OpenAI
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            api_key=openai_key,
            model="text-embedding-3-small",
        )

    raise ValueError(
        "No embedding credentials found. Set GEMINI_API_KEY, AZURE_OPENAI_EMBEDDING_DEPLOYMENT, or OPENAI_API_KEY."
    )


def evaluate(question: str, answer: str, contexts: list[str]) -> dict:
    """Run RAGAS evaluation on a single sample using reference-free metrics."""
    try:
        from ragas import EvaluationDataset, SingleTurnSample, evaluate as ragas_evaluate
        from ragas.metrics import (
            Faithfulness,
            ResponseRelevancy,
            LLMContextPrecisionWithoutReference,
        )

        # Get LLM and embeddings
        llm = get_llm()
        embeddings = get_embeddings()

        # Create sample in new RAGAS format
        sample = SingleTurnSample(
            user_input=question,
            response=answer,
            retrieved_contexts=contexts,
        )
        dataset = EvaluationDataset(samples=[sample])

        # Initialize metrics with LLM
        faithfulness = Faithfulness(llm=llm)
        response_relevancy = ResponseRelevancy(llm=llm, embeddings=embeddings)
        context_precision = LLMContextPrecisionWithoutReference(llm=llm)

        # Run evaluation
        results = ragas_evaluate(
            dataset=dataset,
            metrics=[faithfulness, response_relevancy, context_precision],
        )

        # Extract scores from results
        scores_df = results.to_pandas()

        return {
            "faithfulness": float(scores_df["faithfulness"].iloc[0]) if "faithfulness" in scores_df.columns else None,
            "answer_relevancy": float(scores_df["answer_relevancy"].iloc[0]) if "answer_relevancy" in scores_df.columns else None,
            "context_precision": float(scores_df["llm_context_precision_without_reference"].iloc[0]) if "llm_context_precision_without_reference" in scores_df.columns else None,
            "error": None,
        }

    except ImportError as e:
        return {
            "faithfulness": None,
            "answer_relevancy": None,
            "context_precision": None,
            "error": f"Missing dependency: {str(e)}. Run: pip install -r requirements.txt",
        }
    except Exception as e:
        return {
            "faithfulness": None,
            "answer_relevancy": None,
            "context_precision": None,
            "error": str(e),
        }


def main():
    """Read input from stdin, evaluate, and output to stdout."""
    try:
        # Read JSON from stdin
        input_data = json.loads(sys.stdin.read())

        # Validate required fields
        if "question" not in input_data:
            raise ValueError("Missing required field: question")
        if "answer" not in input_data:
            raise ValueError("Missing required field: answer")
        if "contexts" not in input_data:
            raise ValueError("Missing required field: contexts")
        if not isinstance(input_data["contexts"], list):
            raise ValueError("contexts must be an array")

        # Run evaluation
        result = evaluate(
            question=input_data["question"],
            answer=input_data["answer"],
            contexts=input_data["contexts"],
        )

        # Output result
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(
            json.dumps(
                {
                    "faithfulness": None,
                    "answer_relevancy": None,
                    "context_precision": None,
                    "error": f"Invalid JSON input: {str(e)}",
                }
            )
        )
        sys.exit(1)
    except ValueError as e:
        print(
            json.dumps(
                {
                    "faithfulness": None,
                    "answer_relevancy": None,
                    "context_precision": None,
                    "error": str(e),
                }
            )
        )
        sys.exit(1)
    except Exception as e:
        print(
            json.dumps(
                {
                    "faithfulness": None,
                    "answer_relevancy": None,
                    "context_precision": None,
                    "error": f"Unexpected error: {str(e)}",
                }
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
