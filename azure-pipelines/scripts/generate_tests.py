"""
generate_tests.py
-----------------
Scans source files in TARGET_PATH and generates unit test stubs using Azure
OpenAI.  Writes generated tests to OUTPUT_PATH.

Environment variables:
    AZURE_OPENAI_ENDPOINT     Azure OpenAI resource base URL
    AZURE_OPENAI_KEY          API key (secret)
    AZURE_OPENAI_DEPLOYMENT   Model deployment name
    TARGET_PATH               Relative path to source file or directory
    TEST_FRAMEWORK            xunit | nunit | mstest | vitest | jest
    OUTPUT_PATH               Where to write generated test files
    SOURCE_ROOT               Absolute path to the repository root
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
SOURCE_ROOT: Path = Path(os.environ.get("SOURCE_ROOT", "."))
TARGET_PATH: Path = SOURCE_ROOT / os.environ.get("TARGET_PATH", "src/")
OUTPUT_PATH: Path = SOURCE_ROOT / os.environ.get("OUTPUT_PATH", "tests/generated/")
TEST_FRAMEWORK: str = os.environ.get("TEST_FRAMEWORK", "xunit")

# Maximum number of source lines sent to the model per file to avoid token limits
MAX_SOURCE_LINES: int = 600

# Map extensions to language names for the prompt
EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".cs": "C#",
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".java": "Java",
    ".cls": "Salesforce Apex",
    ".trigger": "Salesforce Apex",
}

FRAMEWORK_INSTRUCTIONS: dict[str, str] = {
    "xunit": (
        "Use xUnit with the [Fact] and [Theory] attributes. "
        "Use FluentAssertions for assertions where appropriate. "
        "Name the test class <ClassName>Tests and place it in the same namespace as the class under test but in the Tests project."
    ),
    "nunit": (
        "Use NUnit with [Test] and [TestCase] attributes. "
        "Use Assert.That() with NUnit constraints for assertions. "
        "Name the test class <ClassName>Tests."
    ),
    "mstest": (
        "Use MSTest with [TestMethod] and [DataRow] attributes. "
        "Use Assert.AreEqual() and Assert.ThrowsException<>() for assertions."
    ),
    "vitest": (
        "Use Vitest with describe/it/expect. "
        "Mock external dependencies with vi.mock(). "
        "Use beforeEach for setup. "
        "Name the test file <FileName>.test.ts."
    ),
    "jest": (
        "Use Jest with describe/it/expect. "
        "Mock external dependencies with jest.mock(). "
        "Use beforeEach for setup. "
        "Name the test file <FileName>.test.ts."
    ),
}

SYSTEM_PROMPT_TEMPLATE = """\
You are a senior software engineer generating unit tests for an Australian
government department codebase.

Rules:
1. Generate complete, compilable test code — no placeholder comments like "TODO".
2. Cover: happy path, error/exception cases, boundary values, null inputs.
3. Mock all external dependencies (databases, HTTP clients, file system).
4. {framework_instructions}
5. Include a comment at the top: "// AI-generated test stubs — review before merging."
6. For government software, add a test case that verifies no sensitive data is
   logged or returned in error messages where applicable.

Respond with ONLY the complete test file content. No markdown fences, no explanation.
"""


def collect_source_files() -> list[Path]:
    """Return reviewable source files from TARGET_PATH."""
    if TARGET_PATH.is_file():
        return [TARGET_PATH] if TARGET_PATH.suffix in EXTENSION_TO_LANGUAGE else []

    files: list[Path] = []
    for ext in EXTENSION_TO_LANGUAGE:
        files.extend(TARGET_PATH.rglob(f"*{ext}"))

    # Exclude test files themselves and generated output
    return [
        f for f in files
        if "test" not in f.stem.lower()
        and "spec" not in f.stem.lower()
        and str(OUTPUT_PATH) not in str(f)
        and "node_modules" not in str(f)
        and "target" not in str(f)
    ]


def generate_tests_for_file(
    client: AzureOpenAI,
    source_file: Path,
) -> str | None:
    """Generate test code for a single source file."""
    language = EXTENSION_TO_LANGUAGE.get(source_file.suffix, "unknown")
    framework_instructions = FRAMEWORK_INSTRUCTIONS.get(
        TEST_FRAMEWORK, FRAMEWORK_INSTRUCTIONS["xunit"]
    )
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        framework_instructions=framework_instructions
    )

    try:
        source_content = source_file.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        print(f"  Could not read {source_file}: {exc}", file=sys.stderr)
        return None

    # Truncate very large files to avoid token limits
    lines = source_content.splitlines()
    if len(lines) > MAX_SOURCE_LINES:
        source_content = "\n".join(lines[:MAX_SOURCE_LINES]) + "\n// [file truncated]"

    user_msg = (
        f"Generate {TEST_FRAMEWORK} unit tests for the following {language} file:\n\n"
        f"File: {source_file.relative_to(SOURCE_ROOT)}\n\n"
        f"{source_content}"
    )

    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        print(f"  OpenAI call failed for {source_file}: {exc}", file=sys.stderr)
        return None


def output_file_path(source_file: Path, test_code: str) -> Path:
    """Determine the output file path for generated tests."""
    stem = source_file.stem
    ext = source_file.suffix

    # Language-appropriate test file naming
    if ext in (".ts", ".tsx", ".js", ".jsx"):
        test_filename = f"{stem}.test{ext}"
    elif ext == ".cs":
        test_filename = f"{stem}Tests.cs"
    elif ext in (".cls", ".trigger"):
        test_filename = f"{stem}Test.cls"
    else:
        test_filename = f"{stem}_test{ext}"

    return OUTPUT_PATH / test_filename


def main() -> None:
    files = collect_source_files()
    if not files:
        print(f"No reviewable source files found in {TARGET_PATH}.")
        return

    print(f"Generating {TEST_FRAMEWORK} tests for {len(files)} file(s) ...")
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

    client = AzureOpenAI(
        azure_endpoint=ENDPOINT,
        api_key=API_KEY,
        api_version="2024-12-01-preview",
    )

    generated_count = 0
    for source_file in files:
        print(f"  Processing {source_file.relative_to(SOURCE_ROOT)} ...")
        test_code = generate_tests_for_file(client, source_file)
        if not test_code:
            continue

        out_path = output_file_path(source_file, test_code)
        out_path.write_text(test_code, encoding="utf-8")
        print(f"    → Written to {out_path.relative_to(SOURCE_ROOT)}")
        generated_count += 1

    print(f"\n{generated_count} test file(s) generated in {OUTPUT_PATH}.")


if __name__ == "__main__":
    main()
