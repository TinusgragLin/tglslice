+++
title="An Inclusive-end Number Range Loop Pitfall"
description="It's also related to Rust."
date=2024-01-05
updated=2024-01-06

[taxonomies]
tags = ["pitfalls", "rust-language", "rust-pitfalls"]
categories = ["pitfalls"]

[extra]
ToC=true
+++

# The Problem

Say we want to implement a function that sum up number 0 to `n` but excludes
a particular "bad number", this is easily accomplished with a loop:

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
while (i <= n) {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
}
```

You may have spot the problem: the loop entry condition is `i <= n`, and at
the end of the loop, `i` is incremented by 1, so at the last iteration, when
`i` reaches `n`, `i` in incremented to `n + 1` at the end of the loop. Now `n`
is a valid `uint32`, but `n + 1`? Not so sure: when `n == 2^32 - 1`, `n + 1`
silently (in C) turns to 0. So `i` goes back to `0` at the end of the last
iteration!

## Solutions

The heart of this problem is the way we use the value of `i` to determine when
the loop needs to end: when `i` is larger than `n`, which is not always possible.

A more safer loop condition is to test whether `i` equals to `n`: the idea is that
when `i == n`, we are done *assuming* we have used this `i`, the very **last** `i`.
Then for the two other steps in the loop (i.e. the consumption and the forwarding),
both have to be before the check, and since the consumption needs to use the last
`i`, the forwarding has to be before the consumption. However, now that the forwarding
is the first step, we will miss the first `i`, so we need to manually add this case:

```c
// Solution 1:
if (0 != BAD_NUMBER)
    sum += 0;
while (1) {
    i++;
    if (i != BAD_NUMBER)
        sum += i;
    if (i == n) break;
}
// Or, equivalently:
do {
    i++;
    if (i != BAD_NUMBER)
        sum += i;
} while (i < n);
```

Another thing to note is that the 'normal' `while (i < n) { ...; i++; }` code most
people will write when `i` is specified to be in the range of `[0, n)` does not have
this problem since it's always possible for `i` to be equal to `n`, which is the loop
exit condition.

From this observation, yet another way to solve the original problem is to split the
range `[0, n]` into `[0, n)` and `n`:

```c
// Solution 2:
while (i < n) {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
}

if (n != BAD_NUMBER)
    sum += n;
```

# The `RangeInclusive` Iterator `next` Optimization Problem in Rust

In Rust, you have another way to avoid the aforementioned problem -- using ranges:

```rust
// 1. Use range in for-loop:
for i in 0..=n { ... }
// 2. Use range's internal iterator method:
(0..=n).for_each(|i| { ... })
(0..=n).fold(0, |i| { ... })
// ...
```

However, there might exist an optimization problem. For our specific case, only the
rewritings in the last section and `fold` approach above triggers SIMD optimizations,
`for i in 0..=n` and `for_each` approach does not.

## An Attempt to Implement An Iterator for `RangeInclusive`

The problem with `for i in 0..=n` is that the use of `0..=n` (`RangeInclusive`) as an
iterator is outside of the iterator itself, so the iterator needs to keep all the progress
information as its data.

Let's try to implement an iterator based on the two solutions presented in the previous
section. For Solution 1, other than `current` and `end`, first we need to know whether we
are at the start of the iterations, storing the start of the range or a simple Bool flag
`has_passed_frist` is enough; second, note that we end the loop **after** the last consumption,
but an iterator produces the next value or `EndOfIteration` **before** consumptions.
Luckily, we can modify the original code a bit to adapt to this order:

```c
// Solution 1:
bool done = false;
if (0 != BAD_NUMBER)
    sum += 0;
while (1) {
    if (done) break;
    i++;
    if (i == n) done = true;

    if (i != BAD_NUMBER)
        sum += i;
}
```

For Solution 2, since both `current` and `end` won't change at the last iteration, we
also need an state variable signifying the end of iterations, and that's it:

```c
bool done = false;

while (i < n) {
    if (i != BAD_NUMBER)
        sum += i;
    i += 1;
}

// When i == n
if (n != BAD_NUMBER)
    sum += n;
done = true
```

Clearly, Solution 2 requires less state variables, so we'll implement Solution 2 as an
iterator:

```rust
struct RangeInclusiveIter { cur: u32, end: u32, done: bool }
// `Iterator::next` implementation:
fn next(&mut self) -> Option<Self::Item> {
    if self.done { return None }
    Some(if self.cur < self.end {
        let next = self.cur + 1;
        std::mem::replace(&mut self.cur, next)
    } else {
        self.done = true;
        self.cur
    })
}
```

Apparently, when using this iterator, the compiler is able to optimize the code
into SIMD code that vastly boosts the performance.

## A Line of Change

However, `larger..=smaller` is permitted and produces exactly
`RangeInclusive { start: larger, end: smaller, ... }` and `RangeInclusive` **itself**
implements `Iterator`, `RangeInclusive::next` has to take care of this case in
the implementation:

```rust
// `Iterator::next` implementation for `RangeInclusive::next`:
fn next(&mut self) -> Option<Self::Item> {
    // ++++++++++++++++++++++++
    if self.start > self.end || self.done { return None }
    Some(if self.start < self.end {
        let next = self.start + 1;
        std::mem::replace(&mut self.start, next)
    } else {
        self.done = true;
        self.start
    })
}
```

And this addition hinders the compiler from applying SIMD optimizations (at the
time of writing)!

## More Confusing

What is more confusing is that when expanding the original iterator implementation
into the equivalent code, the SIMD optimization also is not applied:

```rust
let mut cur = 0;
let mut done = false;
while !done {
    let i = if cur < n {
        let next = cur + 1;
        std::mem::replace(&mut cur, next)
    } else {
        done = true;
        cur
    };
    if i != BAD_NUMBER {
        sum += i as u64
    }
}
```

# Conclusion

When looping over an inclusive-ended range, if the end could reach the largest
representable value, use one of the loop variations mentioned in the first section,
or, in Rust, use `fold`.
