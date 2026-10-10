/* SPDX-License-Identifier: GPL-3.0-or-later
 * LibreDWG's generated DXF contains decimal numbers, never C23 binary literals.
 * Use the long-established strtol ABI so builds on newer glibc also run on
 * glibc 2.34 (Vercel's Amazon Linux 2023 runtime).
 */
extern long strtol(const char *, char **, int);
long __wrap___isoc23_strtol(const char *text, char **end, int base) {
  return strtol(text, end, base);
}
