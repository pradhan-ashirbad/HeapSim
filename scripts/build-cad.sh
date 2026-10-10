#!/usr/bin/env bash
set -euo pipefail
# Rebuild the standalone GPL-3.0-or-later command-line converter on Linux x64.
# Requires CMake, a C compiler, make, and binutils. No downloads are needed.
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
tar -xzf "$repo_dir/public/third-party/libredwg-0.13.3-source.tar.gz" -C "$build_dir"
cmake -S "$build_dir/libredwg-0.13.3" -B "$build_dir/build" \
  -DBUILD_SHARED_LIBS=OFF -DENABLE_LTO=OFF -DDISABLE_WERROR=ON \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "$build_dir/build" --target dxf2dwg -j2
cc -c "$repo_dir/vendor/libredwg/glibc-compat.c" -o "$build_dir/compat.o"
cc -Wl,--wrap=__isoc23_strtol \
  "$build_dir/build/CMakeFiles/dxf2dwg.dir/programs/dxf2dwg.c.o" \
  "$build_dir/compat.o" "$build_dir/build/libredwg.a" -lm \
  -o "$build_dir/dxf2dwg"
install -m 755 "$build_dir/dxf2dwg" "$repo_dir/vendor/libredwg/dxf2dwg"
strip "$repo_dir/vendor/libredwg/dxf2dwg"
