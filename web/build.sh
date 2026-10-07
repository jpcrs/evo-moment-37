#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
if [[ -f "$TASK_ROOT/.tools/emsdk/emsdk_env.sh" ]]; then
  export EMSDK_QUIET=1
  source "$TASK_ROOT/.tools/emsdk/emsdk_env.sh"
elif ! command -v emcc >/dev/null; then
  echo 'Install Emscripten, or run web/setup.sh first.' >&2
  exit 1
fi
python3 web/prepare_assets.py "${1:-$TASK_ROOT/Street Fighter III - 3rd Strike (English v1.0).iso}"
emcmake cmake -S .tools/SDL -B .tools/SDL/build-web -G Ninja -DSDL_SHARED=OFF -DSDL_STATIC=ON -DSDL_TESTS=OFF -DSDL_EXAMPLES=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build .tools/SDL/build-web -j 8
python3 web/specialize.py
emcmake cmake -S web -B web/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build web/build -j 8
cp 3sx/LICENSE web/dist/LICENSE-3SX.txt
cp 3sx/THIRD_PARTY_NOTICES.txt web/dist/THIRD-PARTY-NOTICES.txt

cp .tools/SDL/LICENSE.txt web/dist/LICENSE-SDL.txt

python3 web/audit_build.py
