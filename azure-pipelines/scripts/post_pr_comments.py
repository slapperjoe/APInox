"""
post_pr_comments.py
--------------------
Posts AI-generated review comments to an Azure DevOps pull request using the
Git REST API PR Threads endpoint.

One ADO PR Thread is created per file that has comments.  Within each thread,
individual comments are appended.

Environment variables:
    ADO_PAT                               Personal Access Token (Code read+write)
    BUILD_REPOSITORY_ID                   Repository GUID
    SYSTEM_PULLREQUEST_PULLREQUESTID      PR numeric ID
    SYSTEM_TEAMFOUNDATIONCOLLECTIONURI    Collection base URL
    SYSTEM_TEAMPROJECT                    Project name
    COMMENTS_INPUT_PATH                   Path to the JSON produced by review_with_openai.py

ADO Thread status mapping:
    error   → "active"   (requires attention)
    warning → "active"
    info    → "byDesign" (informational only)
"""

from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

import requests


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ADO_PAT: str = os.environ["ADO_PAT"]
REPO_ID: str = os.environ["BUILD_REPOSITORY_ID"]
PR_ID: str = os.environ["SYSTEM_PULLREQUEST_PULLREQUESTID"]
COLLECTION_URI: str = os.environ["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"].rstrip("/")
PROJECT: str = os.environ["SYSTEM_TEAMPROJECT"]
INPUT_PATH: Path = Path(os.environ["COMMENTS_INPUT_PATH"])

SEVERITY_TO_STATUS: dict[str, str] = {
    "error": "active",
    "warning": "active",
    "info": "byDesign",
}

SEVERITY_EMOJI: dict[str, str] = {
    "error": "🔴",
    "warning": "🟡",
    "info": "🔵",
}

BOT_HEADER = (
    "🤖 **AI Code Review** *(powered by Azure OpenAI — review suggestions only)*\n\n"
)


def _auth_header() -> dict[str, str]:
    token = base64.b64encode(f":{ADO_PAT}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


def _threads_url() -> str:
    return (
        f"{COLLECTION_URI}/{PROJECT}/_apis/git/repositories/{REPO_ID}"
        f"/pullRequests/{PR_ID}/threads?api-version=7.0"
    )


def post_thread(
    file_path: str,
    comments: list[dict[str, Any]],
) -> None:
    """Create a single PR thread containing all comments for one file."""
    # Build the comment text
    lines: list[str] = [BOT_HEADER]
    for c in comments:
        emoji = SEVERITY_EMOJI.get(c.get("severity", "info"), "🔵")
        category = c.get("category", "general").capitalize()
        message = c.get("message", "").strip()
        line_ref = f" (line {c['line']})" if c.get("line") else ""
        lines.append(f"{emoji} **{category}**{line_ref}: {message}\n")

    content = "\n".join(lines)

    # Use the first comment's line for the thread position if available
    first_line: int | None = next(
        (c.get("line") for c in comments if c.get("line")), None
    )

    thread_context: dict[str, Any] | None = (
        {
            "filePath": file_path if file_path.startswith("/") else f"/{file_path}",
            "rightFileStart": {"line": first_line, "offset": 1},
            "rightFileEnd": {"line": first_line, "offset": 1},
        }
        if first_line is not None
        else None
    )

    # Determine overall thread status (worst severity wins)
    severities = [c.get("severity", "info") for c in comments]
    if "error" in severities:
        status = "active"
    elif "warning" in severities:
        status = "active"
    else:
        status = "byDesign"

    payload: dict[str, Any] = {
        "comments": [{"parentCommentId": 0, "content": content, "commentType": 1}],
        "status": status,
    }
    if thread_context is not None:
        payload["threadContext"] = thread_context

    resp = requests.post(
        _threads_url(),
        headers=_auth_header(),
        json=payload,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(
            f"Warning: failed to post thread for {file_path}: "
            f"{resp.status_code} {resp.text}",
            file=sys.stderr,
        )
    else:
        print(f"  Posted thread for {file_path} ({len(comments)} comment(s)).")


def post_summary_comment(total_files: int, total_comments: int) -> None:
    """Post a summary thread on the PR with the overall review stats."""
    if total_comments == 0:
        content = (
            f"{BOT_HEADER}"
            "✅ No issues were identified by the automated AI code review.\n\n"
            "*This is a first-pass automated review only. Human review is still required.*"
        )
    else:
        content = (
            f"{BOT_HEADER}"
            f"**Summary**: {total_comments} issue(s) found across "
            f"{total_files} file(s).\n\n"
            "Please review the inline comments above. "
            "*This is a first-pass automated review only — human review is still required.*"
        )

    payload: dict[str, Any] = {
        "comments": [{"parentCommentId": 0, "content": content, "commentType": 1}],
        "status": "active" if total_comments > 0 else "byDesign",
    }
    resp = requests.post(
        _threads_url(),
        headers=_auth_header(),
        json=payload,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(
            f"Warning: could not post summary comment: {resp.status_code} {resp.text}",
            file=sys.stderr,
        )


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Comments file not found: {INPUT_PATH}", file=sys.stderr)
        sys.exit(1)

    all_results: list[dict[str, Any]] = json.loads(INPUT_PATH.read_text())
    total_comments = sum(len(r.get("comments", [])) for r in all_results)

    print(
        f"Posting {total_comments} comment(s) across "
        f"{len(all_results)} file(s) to PR #{PR_ID} ..."
    )

    for file_result in all_results:
        file_path: str = file_result["file_path"]
        comments: list[dict[str, Any]] = file_result.get("comments", [])
        if comments:
            post_thread(file_path, comments)

    post_summary_comment(len(all_results), total_comments)
    print("Done.")


if __name__ == "__main__":
    main()
