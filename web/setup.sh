#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
mkdir -p .tools
command -v cmake >/dev/null || { echo 'Install CMake and Ninja first.' >&2; exit 1; }
command -v ninja >/dev/null || { echo 'Install Ninja first.' >&2; exit 1; }
if [[ ! -d .tools/emsdk ]]; then git clone --depth 1 https://github.com/emscripten-core/emsdk.git .tools/emsdk; fi
TASK_PYTHON="${PYTHON:-}"
if [[ -z "$TASK_PYTHON" ]]; then
  for candidate in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
      TASK_PYTHON="$candidate"
      break
    fi
  done
fi
if [[ -z "$TASK_PYTHON" ]]; then echo 'Install Python 3.10 or newer for Emscripten setup.' >&2; exit 1; fi
"$TASK_PYTHON" .tools/emsdk/emsdk.py install 6.0.11
"$TASK_PYTHON" .tools/emsdk/emsdk.py activate 6.0.11
if [[ ! -d .tools/SDL ]]; then git clone --depth 1 --branch release-3.4.12 https://github.com/libsdl-org/SDL.git .tools/SDL; fi
bash web/build.sh
