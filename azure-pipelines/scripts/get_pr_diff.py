"""
get_pr_diff.py
--------------
Fetches the file-level diff for the current ADO pull request and writes a
structured JSON file that the review script can consume.

Environment variables (all injected by the ADO pipeline):
    ADO_PAT                               Personal Access Token
    BUILD_REPOSITORY_ID                   Repository GUID
    SYSTEM_PULLREQUEST_PULLREQUESTID      PR numeric ID
    SYSTEM_TEAMFOUNDATIONCOLLECTIONURI    Collection base URL
    SYSTEM_TEAMPROJECT                    Project name
    MAX_FILES_TO_REVIEW                   Max number of files to include
    MAX_DIFF_LINES                        Max diff lines per file
    DIFF_OUTPUT_PATH                      Where to write the output JSON

Output JSON schema:
    {
        "pr_id": 123,
        "files": [
            {
                "path": "src/MyClass.cs",
                "extension": ".cs",
                "diff": "<unified diff text, truncated if too long>"
            }
        ]
    }
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import requests


# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
ADO_PAT: str = os.environ["ADO_PAT"]
REPO_ID: str = os.environ["BUILD_REPOSITORY_ID"]
PR_ID: str = os.environ["SYSTEM_PULLREQUEST_PULLREQUESTID"]
COLLECTION_URI: str = os.environ["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"].rstrip("/")
PROJECT: str = os.environ["SYSTEM_TEAMPROJECT"]
MAX_FILES: int = int(os.environ.get("MAX_FILES_TO_REVIEW", "20"))
MAX_LINES: int = int(os.environ.get("MAX_DIFF_LINES", "400"))
OUTPUT_PATH: Path = Path(os.environ["DIFF_OUTPUT_PATH"])

# ADO-supplied branch refs — more reliable than origin/HEAD in PR builds
# Format: "refs/heads/feature/my-branch"
_SOURCE_BRANCH: str = os.environ.get("SYSTEM_PULLREQUEST_SOURCEBRANCH", "")
_TARGET_BRANCH: str = os.environ.get("SYSTEM_PULLREQUEST_TARGETBRANCH", "")

# File extensions to review — extend as needed
REVIEWABLE_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".cs", ".csproj",                           # .NET
        ".ts", ".tsx", ".js", ".jsx", ".json",      # JavaScript / TypeScript
        ".cls", ".trigger", ".apex",                # Salesforce Apex
        ".java",                                    # Java (FMW custom code)
        ".xml", ".wsdl", ".xsd",                   # XML / WSDL / XSD
        ".py",                                      # Python scripts
        ".yml", ".yaml",                            # Pipelines
    }
)

# Extensions to skip entirely (binary, generated, or sensitive)
SKIP_EXTENSIONS: frozenset[str] = frozenset(
    {".pfx", ".p12", ".key", ".pem", ".dll", ".exe", ".png", ".jpg", ".lock"}
)


def _auth_header() -> dict[str, str]:
    """Return a Basic-auth header for the ADO REST API."""
    token = base64.b64encode(f":{ADO_PAT}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


def get_pr_changes() -> list[dict[str, Any]]:
    """Return the list of changed items in the PR via the ADO Git REST API."""
    url = (
        f"{COLLECTION_URI}/{PROJECT}/_apis/git/repositories/{REPO_ID}"
        f"/pullRequests/{PR_ID}/iterations?api-version=7.0"
    )
    resp = requests.get(url, headers=_auth_header(), timeout=30)
    resp.raise_for_status()
    iterations = resp.json().get("value", [])
    if not iterations:
        print("No iterations found for PR — nothing to review.")
        return []

    # Use the latest iteration
    latest_iteration_id: int = iterations[-1]["id"]
    changes_url = (
        f"{COLLECTION_URI}/{PROJECT}/_apis/git/repositories/{REPO_ID}"
        f"/pullRequests/{PR_ID}/iterations/{latest_iteration_id}"
        f"/changes?api-version=7.0&$top=200"
    )
    changes_resp = requests.get(changes_url, headers=_auth_header(), timeout=30)
    changes_resp.raise_for_status()
    return changes_resp.json().get("changeEntries", [])


def _branch_short(ref: str) -> str:
    """Strip 'refs/heads/' prefix from an ADO branch ref."""
    return ref.removeprefix("refs/heads/")


def git_diff_for_file(file_path: str) -> str:
    """Return the unified diff for a single file using the local git repo.

    Uses the ADO-provided source/target branch variables so the diff range is
    accurate regardless of how origin/HEAD resolves in the pipeline workspace.
    """
    if _SOURCE_BRANCH and _TARGET_BRANCH:
        target_ref = f"origin/{_branch_short(_TARGET_BRANCH)}"
        source_ref = f"origin/{_branch_short(_SOURCE_BRANCH)}"
        diff_range = f"{target_ref}...{source_ref}"
    else:
        # Fallback: compare staged/unstaged changes against HEAD
        diff_range = "HEAD"

    try:
        result = subprocess.run(
            ["git", "diff", diff_range, "--", file_path],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        diff_text = result.stdout
        lines = diff_text.splitlines()
        if len(lines) > MAX_LINES:
            lines = lines[:MAX_LINES]
            lines.append(f"\n[... diff truncated at {MAX_LINES} lines ...]")
        return "\n".join(lines)
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: could not get diff for {file_path}: {exc}", file=sys.stderr)
        return ""


def main() -> None:
    changes = get_pr_changes()
    if not changes:
        result: dict[str, Any] = {"pr_id": int(PR_ID), "files": []}
        OUTPUT_PATH.write_text(json.dumps(result, indent=2))
        return

    files: list[dict[str, Any]] = []
    for entry in changes:
        item = entry.get("item", {})
        path: str = item.get("path", "")
        change_type: str = entry.get("changeType", "")

        if not path or change_type in ("delete", "Delete"):
            continue

        ext = Path(path).suffix.lower()
        if ext in SKIP_EXTENSIONS:
            continue
        if ext not in REVIEWABLE_EXTENSIONS:
            continue

        diff = git_diff_for_file(path.lstrip("/"))
        if not diff.strip():
            continue

        files.append({"path": path, "extension": ext, "diff": diff})
        if len(files) >= MAX_FILES:
            print(
                f"Reached MAX_FILES_TO_REVIEW ({MAX_FILES}). "
                "Remaining files will not be reviewed in this run."
            )
            break

    result = {"pr_id": int(PR_ID), "files": files}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2))
    print(f"Diff written to {OUTPUT_PATH} ({len(files)} file(s)).")


if __name__ == "__main__":
    main()
