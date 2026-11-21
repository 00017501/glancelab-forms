"""Select the review scope and run non-mutating backend and frontend checks."""

import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Python checks run from here so each tool finds the configuration in its pyproject.toml.
BACKEND_DIR = "backend"
# Ruff ignores the project's `exclude` for paths named on the command line unless forced.
PYTHON_CHECKS = (
    ("Ruff lint", "ruff", ("check", "--no-fix", "--force-exclude", "--")),
    ("Ruff format", "ruff", ("format", "--check", "--force-exclude", "--")),
    ("Pyright", "pyright", ()),
)
# Each frontend app is checked as a whole: a type error rarely stays inside the changed file.
FRONTEND_APPS = ("frontend/admin", "frontend/participant")
FRONTEND_SCRIPTS = ("typecheck", "lint")


@dataclass(frozen=True)
class ReviewScope:
    """Keep deleted paths in the review while checking only files that still exist."""

    root: Path
    paths: tuple[str, ...]
    merge_base: str | None = None

    @property
    def backend_python_paths(self) -> tuple[str, ...]:
        """Return regular Python files under the backend, relative to it, excluding symlinks."""
        prefix = f"{BACKEND_DIR}/"
        return tuple(
            path.removeprefix(prefix)
            for path in self.paths
            if path.startswith(prefix)
            and Path(path).suffix in {".py", ".pyi"}
            and (self.root / path).is_file()
            and not (self.root / path).is_symlink()
        )

    @property
    def changed_frontend_apps(self) -> tuple[str, ...]:
        """Return the frontend apps that contain at least one changed path."""
        return tuple(app for app in FRONTEND_APPS if any(path.startswith(f"{app}/") for path in self.paths))


def run_git(root: Path, *arguments: str) -> bytes:
    """Run Git with literal arguments and preserve failures for the caller."""
    return subprocess.run(  # noqa: S603 - argument list only, never a shell
        ["git", *arguments],  # noqa: S607 - use the developer's installed Git
        cwd=root,
        check=True,
        capture_output=True,
    ).stdout


def select_scope(directory: Path, base: str | None = None) -> ReviewScope:
    """Collect branch, index, working-tree, and untracked changes without losing filenames."""
    root = Path(os.fsdecode(run_git(directory, "rev-parse", "--show-toplevel").rstrip(b"\n")))
    merge_base = None
    commands = [
        ("diff", "--name-only", "--no-renames", "-z", "--"),
        ("diff", "--cached", "--name-only", "--no-renames", "-z", "--"),
        ("ls-files", "--others", "--exclude-standard", "-z"),
    ]
    if base is not None:
        revision = run_git(root, "rev-parse", "--verify", "--end-of-options", f"{base}^{{commit}}").strip().decode()
        merge_base = run_git(root, "merge-base", "HEAD", revision).strip().decode()
        commands.append(("diff", "--name-only", "--no-renames", "-z", merge_base, "HEAD", "--"))
    paths = {os.fsdecode(path) for command in commands for path in run_git(root, *command).split(b"\0") if path}
    return ReviewScope(root, tuple(sorted(paths)), merge_base)


def report(label: str, returncode: int) -> int:
    """Print one check result and return the exit code it contributes."""
    sys.stdout.write(f"{label}: {'passed' if returncode == 0 else 'failed'} (exit {returncode}).\n")
    sys.stdout.flush()
    return 0 if returncode == 0 else max(returncode, 1)


def run_python_checks(scope: ReviewScope) -> int:
    """Run the Python tools over changed backend files; an uninstalled tool counts as a failure."""
    paths = scope.backend_python_paths
    if not paths:
        labels = ", ".join(label for label, _, _ in PYTHON_CHECKS)
        sys.stdout.write(f"{labels}: not applicable (no existing Python files under {BACKEND_DIR}/).\n")
        return 0
    exit_code = 0
    for label, module, arguments in PYTHON_CHECKS:
        if importlib.util.find_spec(module) is None:
            sys.stdout.write(f"{label}: unavailable ({module} is not installed).\n")
            exit_code = exit_code or 2
            continue
        result = subprocess.run(  # noqa: S603 - fixed module and literal filename arguments, no shell
            [sys.executable, "-m", module, *arguments, *paths],
            cwd=scope.root / BACKEND_DIR,
            check=False,
        )
        exit_code = exit_code or report(label, result.returncode)
    return exit_code


def run_frontend_checks(scope: ReviewScope) -> int:
    """Run the type check and lint scripts of every frontend app that has changed files."""
    apps = scope.changed_frontend_apps
    if not apps:
        sys.stdout.write("Frontend checks: not applicable (no frontend paths).\n")
        return 0
    npm = shutil.which("npm")
    exit_code = 0
    for app in apps:
        directory = scope.root / app
        if npm is None or not (directory / "node_modules").is_dir():
            sys.stdout.write(f"{app}: unavailable (npm or node_modules is missing; run npm install).\n")
            exit_code = exit_code or 2
            continue
        for script in FRONTEND_SCRIPTS:
            result = subprocess.run(  # noqa: S603 - fixed script names, no shell
                [npm, "run", "--silent", script],
                cwd=directory,
                check=False,
            )
            exit_code = exit_code or report(f"{app} {script}", result.returncode)
    return exit_code


def main() -> int:
    """Report the selected scope and run checks from any directory in the checkout."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base", help="Explicit local base ref, usually main or origin/main; never fetched automatically"
    )
    args = parser.parse_args()
    try:
        scope = select_scope(Path.cwd(), args.base)
    except (OSError, subprocess.CalledProcessError) as error:
        sys.stderr.write(f"Review scope: failed ({error}).\n")
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            sys.stderr.write(os.fsdecode(error.stderr))
        return 2
    label = f"merge base {scope.merge_base} through HEAD plus local changes" if args.base else "local changes"
    sys.stdout.write(f"Review scope: {label}; {len(scope.paths)} paths.\n")
    for path in scope.paths:
        sys.stdout.write(f"  {path!r}\n")
    sys.stdout.flush()
    python_code = run_python_checks(scope)
    frontend_code = run_frontend_checks(scope)
    return python_code or frontend_code


if __name__ == "__main__":
    raise SystemExit(main())
