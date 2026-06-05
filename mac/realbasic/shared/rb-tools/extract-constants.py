#!/usr/bin/env python3
"""
extract-constants.py -- recover constant values from a RealBASIC project file.

RealBASIC's exported "source text" contains method bodies but NOT the values of
project constants / module properties. Those live in the project binary (the
.rbp file, or a saved-app's data fork) as a run of length-prefixed tokens:

    [typeByte][lenByte][string of len bytes]

where a constant is stored as a NAME token (typeByte 0) immediately followed by
a VALUE token (typeByte 1 or 2). For example, the Mobility project encodes:

    [0][6]constK [2][2]10   [0][6]floorY [1][1]1   [0][10]absorbtion [2][2].8 ...

Getting these exactly right matters: guessed physics constants made the first
Mobility port "not move like the original."

Usage:
    python3 extract-constants.py PROJECT_FILE [name1 name2 ...]

With no names, it prints every NAME->VALUE pair it finds (the constants block
usually appears as one contiguous run). With names, it prints just those.
"""
import sys, re

def tokenize(data):
    """Yield (offset, type_byte, text) for every [type][len][printable*len] run."""
    i, n = 0, len(data)
    while i < n - 2:
        t = data[i]
        L = data[i + 1]
        if t <= 3 and 1 <= L <= 64 and i + 2 + L <= n:
            chunk = data[i + 2:i + 2 + L]
            if all(32 <= b < 127 for b in chunk):
                yield (i, t, chunk.decode("ascii"))
                i += 2 + L
                continue
        i += 1

NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
VALUE_RE = re.compile(r"^-?\.?[0-9][0-9.]*$|^-?[0-9]*\.?[0-9]+$")

def extract(data):
    toks = list(tokenize(data))
    pairs = []
    for j in range(len(toks) - 1):
        _, t0, s0 = toks[j]
        _, t1, s1 = toks[j + 1]
        # a NAME token (type 0, identifier-like) followed by a numeric VALUE
        if t0 == 0 and NAME_RE.match(s0) and t1 in (1, 2) and VALUE_RE.match(s1):
            pairs.append((s0, s1))
    return pairs

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    data = open(sys.argv[1], "rb").read()
    wanted = set(sys.argv[2:])
    pairs = extract(data)
    seen = {}
    for name, value in pairs:
        if wanted and name not in wanted:
            continue
        # keep the first occurrence (the declaration block)
        if name not in seen:
            seen[name] = value
            print(f"{name} = {value}")
    if wanted:
        for w in wanted:
            if w not in seen:
                print(f"{w} = <not found>")

if __name__ == "__main__":
    main()
