"""
Provider-agnostic chat completion layer.

One function — chat(system, messages) — that talks to whichever provider
LLM_PROVIDER names. Anthropic is the default and the only one whose SDK is
in requirements.txt; the OpenAI and Gemini branches are ready to go the
moment you add their key and SDK, so you can A/B them on your own prompts
without touching coach.py.

Environment variables:
    LLM_PROVIDER   anthropic (default) | openai | gemini
    LLM_MODEL      overrides the per-provider default model
    ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY

Every branch returns a plain string (the assistant's reply) and raises
LLMError on failure so the caller can degrade gracefully.
"""

import os

PROVIDER = os.environ.get("LLM_PROVIDER", "anthropic").lower()

DEFAULT_MODELS = {
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "gemini": "gemini-2.5-flash",
}
MODEL = os.environ.get("LLM_MODEL", DEFAULT_MODELS.get(PROVIDER, DEFAULT_MODELS["anthropic"]))

MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "400"))


class LLMError(Exception):
    pass


def chat(system, messages):
    """
    system:   str, the system prompt
    messages: list of {"role": "user"|"assistant", "content": str}
    returns:  str reply
    """
    if PROVIDER == "anthropic":
        return _anthropic(system, messages)
    if PROVIDER == "openai":
        return _openai(system, messages)
    if PROVIDER == "gemini":
        return _gemini(system, messages)
    raise LLMError(f"unknown LLM_PROVIDER: {PROVIDER}")


def _anthropic(system, messages):
    try:
        import anthropic
    except ImportError:
        raise LLMError("anthropic SDK not installed — pip install -r requirements.txt")
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise LLMError("ANTHROPIC_API_KEY not set")
    try:
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=messages,
        )
        # Concatenate any text blocks in the response.
        return "".join(block.text for block in resp.content if block.type == "text").strip()
    except Exception as err:
        raise LLMError(f"anthropic request failed: {err}")


def _openai(system, messages):
    try:
        from openai import OpenAI
    except ImportError:
        raise LLMError("openai SDK not installed — pip install openai")
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise LLMError("OPENAI_API_KEY not set")
    try:
        client = OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "system", "content": system}] + messages,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as err:
        raise LLMError(f"openai request failed: {err}")


def _gemini(system, messages):
    try:
        import google.generativeai as genai
    except ImportError:
        raise LLMError("google-generativeai SDK not installed — pip install google-generativeai")
    key = os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise LLMError("GOOGLE_API_KEY not set")
    try:
        genai.configure(api_key=key)
        model = genai.GenerativeModel(MODEL, system_instruction=system)
        # Gemini uses "model" instead of "assistant" for its role name.
        history = [
            {"role": "model" if m["role"] == "assistant" else "user", "parts": [m["content"]]}
            for m in messages
        ]
        resp = model.generate_content(history, generation_config={"max_output_tokens": MAX_TOKENS})
        return (resp.text or "").strip()
    except Exception as err:
        raise LLMError(f"gemini request failed: {err}")


def provider_info():
    return {"provider": PROVIDER, "model": MODEL}
