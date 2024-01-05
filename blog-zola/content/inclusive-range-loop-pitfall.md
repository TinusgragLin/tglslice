+++
title="An Inclusive-end Number Range Loop Pitfall"
description="It's also related to Rust."
date=2024-01-05

[taxonomies]
tags = ["pitfalls", "rust-language", "rust-pitfalls"]
categories = ["pitfalls"]
+++

Say we want to implement a function that sum up number 0 to `n` but excludes
a particular "bad number", this is easily acccomplished with a loop:

```c
#define BAD_NUMBER 69

uint64_t sum_of_all_good(uint32_t n) {
    uint64_t sum = 0;
    for (uint32_t i = 0; i <= n; i++) {
        if (i != BAD_NUMBER)
            sum += i;
    }

    return sum;
}
```

Of cause, we are careful programmers, when `n` is a `uint32`, the `sum` is
defined to be a `uint64` to avoid overflow. Assuming `n` is not larger than
`2^32 - 1`, the program does exactly what we want, right?

Before giving a definitive answer, we may first de-sugar the for-loop down
to a more primitive form, while-loop:

```c
uint64_t sum = 0;
uint64_t i = 0;
while i <= n {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
}
```

You may have spot the problem: the loop entry condition is `i <= n`, and at
the end of the loop, `i` is incremented by 1, so at the last iteration, when
`i` reaches `n`, `i` in incremented to `n + 1` at the end of the loop. Now `n`
is a valid `uint32`, but `n + 1`? Not so sure: when `n == 2^32 - 1`, `n + 1`
siliently (in C) turns to 0. So `i` goes back to `0` at the end of the last
iteration!

The heart of this problem is the way we use the value of `i` to determine when
the loop needs to end: when `i` is larger than `n`, which is not always possible.

A more safer way is to say that when `i` equals to `n`, we are done *after* we
use this `i` to do the last iteration:

```c
uint64_t sum = 0;
uint64_t i = 0;

while 1 {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
    if (i == n) {
        break;
    }
}
// Or, equivalently:
do {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
} while(i < n)
```


