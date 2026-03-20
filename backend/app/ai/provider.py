from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.settings import settings


@dataclass
class AiMappingSuggestion:
    source_field: str
    target_field: str | None
    confidence: float
    rationale: str


class AiProvider:
    def available(self) -> tuple[bool, str]:
        if not settings.ai_enabled:
            return False, "AI is disabled by configuration."
        if not settings.ai_api_key:
            return False, "AI API key is missing."
        return True, "AI provider is configured."

    def suggest_column_mappings(
        self,
        *,
        source_id: str,
        columns: list[str],
        sample_rows: list[dict[str, Any]],
        canonical_targets: list[str],
        deterministic_hints: dict[str, dict[str, Any]],
    ) -> tuple[list[AiMappingSuggestion], list[str]]:
        ok, reason = self.available()
        if not ok:
            return [], [reason]

        prompt = self._build_prompt(
            source_id=source_id,
            columns=columns,
            sample_rows=sample_rows,
            canonical_targets=canonical_targets,
            deterministic_hints=deterministic_hints,
        )
        try:
            content = self._chat_completion(prompt)
            payload = self._extract_json(content)
        except Exception as exc:
            return [], [f"AI call failed: {exc}"]

        items = payload.get("mappings", []) if isinstance(payload, dict) else []
        suggestions: list[AiMappingSuggestion] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            source_field = str(item.get("source_field", "")).strip()
            if not source_field:
                continue
            target_field_raw = item.get("target_field")
            target_field = str(target_field_raw).strip() if target_field_raw else None
            confidence_raw = item.get("confidence", 0.0)
            try:
                confidence = float(confidence_raw)
            except (TypeError, ValueError):
                confidence = 0.0
            confidence = max(0.0, min(1.0, confidence))
            rationale = str(item.get("rationale", "")).strip() or "No rationale provided."
            suggestions.append(
                AiMappingSuggestion(
                    source_field=source_field,
                    target_field=target_field,
                    confidence=round(confidence, 4),
                    rationale=rationale,
                )
            )
        return suggestions, ["AI mapping suggestions generated via provider call."]

    def _build_prompt(
        self,
        *,
        source_id: str,
        columns: list[str],
        sample_rows: list[dict[str, Any]],
        canonical_targets: list[str],
        deterministic_hints: dict[str, dict[str, Any]],
    ) -> str:
        return (
            "You map healthcare source columns to canonical target fields.\n"
            "Return strict JSON only, with top-level shape:\n"
            '{"mappings":[{"source_field":"...", "target_field":"...", "confidence":0.0, "rationale":"..."}]}\n'
            "Rules:\n"
            "- Use only target fields from canonical_targets.\n"
            "- If uncertain, set target_field to null and confidence <= 0.5.\n"
            "- Handle multilingual and abbreviation variants.\n"
            "- Keep rationale concise and practical.\n\n"
            f"source_id: {source_id}\n"
            f"columns: {json.dumps(columns, ensure_ascii=True)}\n"
            f"sample_rows: {json.dumps(sample_rows[:12], ensure_ascii=True)}\n"
            f"canonical_targets: {json.dumps(canonical_targets, ensure_ascii=True)}\n"
            f"deterministic_hints: {json.dumps(deterministic_hints, ensure_ascii=True)}\n"
        )

    def _chat_completion(self, prompt: str) -> str:
        url = f"{settings.ai_api_base_url.rstrip('/')}/chat/completions"
        body = {
            "model": settings.ai_model,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a strict JSON generator for healthcare column mapping. "
                        "Do not output markdown."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
        data = json.dumps(body).encode("utf-8")
        req = Request(
            url=url,
            data=data,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.ai_api_key}",
            },
        )
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                with urlopen(req, timeout=settings.ai_timeout_seconds) as res:
                    raw = res.read().decode("utf-8", errors="replace")
                break
            except HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                # Retry once for transient upstream errors/rate limits.
                if attempt == 0 and exc.code in {408, 429, 500, 502, 503, 504}:
                    last_error = RuntimeError(f"HTTP {exc.code}: {detail}")
                    time.sleep(0.5)
                    continue
                raise RuntimeError(f"HTTP {exc.code}: {detail}")
            except URLError as exc:
                # Retry once for transient network/read-timeout failures.
                if attempt == 0:
                    last_error = RuntimeError(f"Network error: {exc}")
                    time.sleep(0.5)
                    continue
                raise RuntimeError(f"Network error: {exc}")
        else:
            if last_error is not None:
                raise last_error
            raise RuntimeError("AI provider request failed without details.")
        payload = json.loads(raw)
        choices = payload.get("choices", [])
        if not choices:
            raise RuntimeError("No choices returned from AI provider.")
        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise RuntimeError("Empty AI response content.")
        return str(content)

    def _extract_json(self, content: str) -> dict[str, Any]:
        text = content.strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Fallback: try to parse first JSON object slice.
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            snippet = text[start : end + 1]
            parsed = json.loads(snippet)
            if isinstance(parsed, dict):
                return parsed
        raise RuntimeError("AI response did not contain parseable JSON object.")


ai_provider = AiProvider()

