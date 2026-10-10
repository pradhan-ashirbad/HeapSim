# DWG command-line converter

`dxf2dwg` is a Linux x86-64 build of GNU LibreDWG 0.13.3,
commit `97c7225596c17430b82fd0161e7eff6beb5b1034`, licensed under
**GPL-3.0-or-later**. See `COPYING`. It is invoked as a separate process by
the CAD export endpoint to encode application-generated DXF as AutoCAD 2000 DWG.

Upstream: https://github.com/LibreDWG/libredwg/tree/0.13.3

The complete corresponding source, including the pinned jsmn submodule, is
provided in `public/third-party/libredwg-0.13.3-source.tar.gz` and is served at
`/third-party/libredwg-0.13.3-source.tar.gz` by the application. Rebuild with
`bash scripts/build-cad.sh`; CMake, GCC, make and binutils are required. The
build links LibreDWG into the executable; standard system libraries remain
dynamically linked. `glibc-compat.c` (GPL-3.0-or-later) redirects C23 strtol to
the established decimal parser ABI, making the executable compatible with
glibc 2.34 as used on Vercel. The upstream source is otherwise unmodified.
Source, compatibility wrapper, build script and license must accompany redistribution.

The checked-in executable supports Linux x64 deployments (including Vercel).
Other local platforms can export DXF without the executable. No external CAD
conversion service or license key is used. LibreDWG's supported writer version
is intentionally fixed at R2000; the app exports basic 3DFACE, LINE and TEXT
entities, with metre units. These are editable surface meshes, not ACIS solids.
