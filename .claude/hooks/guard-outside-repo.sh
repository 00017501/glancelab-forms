#!/usr/bin/env bash
# PreToolUse hook for Edit / Write / NotebookEdit.
# Blocks a file edit whose target is outside this repository, so other checkouts on the
# machine can never be modified from a session here.
# Allowed besides the repo: the agent's own config folders (plans, memory) and temp folders.
# Exit 0 = allow, exit 2 = block (stderr is shown to the agent).
set -euo pipefail

repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

REPO_ROOT="$repo_root" python3 -c '
import json
import os
import sys
import tempfile
from pathlib import Path

payload = json.load(sys.stdin)
tool_input = payload.get("tool_input") or {}
raw = tool_input.get("file_path") or tool_input.get("notebook_path")
if not raw:
    sys.exit(0)

target = Path(raw).expanduser()
if not target.is_absolute():
    target = Path(payload.get("cwd") or os.getcwd()) / target
target = target.resolve()

home = Path.home()
allowed = [Path(os.environ["REPO_ROOT"]).resolve()]
allowed += [path.resolve() for path in home.glob(".claude*")]
allowed += [Path(tempfile.gettempdir()).resolve(), Path("/tmp").resolve(), Path("/private/var/folders")]

if any(target == root or root in target.parents for root in allowed):
    sys.exit(0)

sys.stderr.write(
    f"Blocked: {target} is outside this repository. "
    "Sessions in this repository only edit files inside it.\n"
)
sys.exit(2)
'
