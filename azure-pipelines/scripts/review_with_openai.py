"""
review_with_openai.py
---------------------
Sends each changed file's diff to Azure OpenAI and collects structured review
comments.  Writes a JSON file containing the comments for post_pr_comments.py.

Environment variables:
    AZURE_OPENAI_ENDPOINT      Base URL of the Azure OpenAI resource
    AZURE_OPENAI_KEY           API key (secret)
    AZURE_OPENAI_DEPLOYMENT    Model deployment name (e.g. gpt-4o)
    DIFF_INPUT_PATH            Path to the JSON produced by get_pr_diff.py
    COMMENTS_OUTPUT_PATH       Where to write the output JSON

Output JSON schema:
    [
        {
            "file_path": "src/MyClass.cs",
            "comments": [
                {
                    "line": 42,          // null if file-level comment
                    "severity": "warning",  // "info" | "warning" | "error"
                    "category": "security", // free text
                    "message": "..."
                }
            ]
        }
    ]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from openai import AzureOpenAI


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ENDPOINT: str = os.environ["AZURE_OPENAI_ENDPOINT"]
API_KEY: str = os.environ["AZURE_OPENAI_KEY"]
DEPLOYMENT: str = os.environ["AZURE_OPENAI_DEPLOYMENT"]
INPUT_PATH: Path = Path(os.environ["DIFF_INPUT_PATH"])
OUTPUT_PATH: Path = Path(os.environ["COMMENTS_OUTPUT_PATH"])

# Prompt template — adjust to match your coding standards
SYSTEM_PROMPT = """\
You are a senior software engineer performing a code review for an Australian
government department.  Your role is to identify:
1. Security vulnerabilities (OWASP Top 10, input validation, secrets in code).
2. Missing or inadequate error handling.
3. Missing unit tests for new public methods or functions.
4. Violations of SOLID principles or excessive complexity.
5. Performance issues (N+1 queries, blocking async calls, unnecessary allocations).
6. Accessibility or compliance issues relevant to government software.

Respond ONLY with a JSON array of comment objects.  Each object must have:
  - "line": integer line number in the diff where the issue is (null for file-level)
  - "severity": one of "info", "warning", or "error"
  - "category": short category string (e.g. "security", "testing", "error-handling")
  - "message": a concise, actionable description of the issue (≤ 200 characters)

If there are no issues, return an empty array: []
Do not include explanatory prose outside the JSON array.
"""

USER_PROMPT_TEMPLATE = """\
Review the following git diff for the file `{file_path}`:

```diff
{diff}
```
"""


def review_file(client: AzureOpenAI, file_path: str, diff: str) -> list[dict[str, Any]]:
    """Send a single file diff to Azure OpenAI and return parsed comments."""
    user_msg = USER_PROMPT_TEMPLATE.format(file_path=file_path, diff=diff)
    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or "[]"
        parsed = json.loads(raw)
        # Accept either a bare array or an object with a "comments" key
        if isinstance(parsed, dict):
            parsed = parsed.get("comments", next(iter(parsed.values()), []))
        if not isinstance(parsed, list):
            return []
        return parsed
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: OpenAI call failed for {file_path}: {exc}", file=sys.stderr)
        return []


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Diff file not found: {INPUT_PATH}", file=sys.stderr)
        sys.exit(1)

    diff_data: dict[str, Any] = json.loads(INPUT_PATH.read_text())
    files: list[dict[str, Any]] = diff_data.get("files", [])

    if not files:
        print("No reviewable files in diff — skipping OpenAI call.")
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text("[]")
        return

    client = AzureOpenAI(
        azure_endpoint=ENDPOINT,
        api_key=API_KEY,
        api_version="2024-12-01-preview",
    )

    all_results: list[dict[str, Any]] = []
    for file_entry in files:
        file_path: str = file_entry["path"]
        diff: str = file_entry["diff"]
        print(f"  Reviewing {file_path} ...")
        comments = review_file(client, file_path, diff)
        if comments:
            all_results.append({"file_path": file_path, "comments": comments})
            print(f"    → {len(comments)} comment(s) generated.")
        else:
            print("    → No issues found.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(all_results, indent=2))
    total = sum(len(r["comments"]) for r in all_results)
    print(f"\nTotal comments generated: {total}. Written to {OUTPUT_PATH}.")


if __name__ == "__main__":
    main()
