+++
title="On the Relation Requirement for Some Sorting Algorithms"
description="My walk through of what some of the sorting algorithms requres."
date=2025-07-21
updated=2025-07-23

[taxonomies]
tags = ["sorting", "math"]
categories = ["dive-into-that-lake"]

[extra]
ToC=true
+++

# The Problem

Given a list of elements from a set `S` and a relation `<` defined on `S`, we
want to find a permutation of the list so that for *any two* elements in the
permuted list, we should have `not (element after < element before)`.

# Bubble Sort

Take bubble sort as an example, the algorithm conceptually split the current list
into the sorted and unsorted part, and in each iteration, it tries to find the
*smallest* element of the unsorted part and place such element at the end of the
sorted list, thus reduce the size of the unsorted part.

## Find the smallest

This process is usually done by a linear walk with swapping: we start with the
first element of the unsorted part, `a`, and tries to find an element `b` after
`a` such that `b < a`. Once we do find such `b`, we swap `a` with `b`, then we
tries to find an element `c` *after the swapped `a`* such that `c < b` and
swap `b` with `c`, and so on and so forth:

```
We find the first b such that b < a, ...

a ... b ... c ...
 |---|
 each x: not (x < a)

We switch b with a, ...

b ... a ... c ...

Then we find c such that c < b, ...

b ... a ... c ...
       |---|
       each x: `not (x < b)`

We switch c with b, ...

c ... a ... b ...

Then we try to find d such that d < c, but failed:

c ... a ... b ...
             |---|
             each x: `not (x < c)`

We end.
```

## Implicit Assumption

For this process to be able to find the "smallest" element of all the unsorted
part (a element `s` such that there exist no other `x` that satisfies `x < s`),
we implicitly assumes that:

1. `b < a` and `a < b` cannot hold at the same time (**Asymmetry**).

   Note that this implies `not (a < a)` (**Irreflexivity**) since if `a < a`
   holds, then `not (a < a)` also holds, as per the rule above, which is a
   clear contradiction.
2. If `b < a` and `not (c < a)`, then `not (c < b)`.

   To see this, note that in the process described above, we assume that if
   `b < a` and no elements after `a` and before `b` is `< a`, then no element
   in this range is `< b` as well, thus we skip this range when trying to
   find a `c < b`.

If we apply the rule that if `A and B => C`, then `not C => (not A) or (not B)`,
so `(not C) and A => not B` on the second assumption, we get:

- If `c < b` and `b < a`, then `c < a` (**Transitivity**).

## Good to Go

So, are these two rules enough? Let us check the first iteration:

After the walk ended, we have found a list of elements `x(1), x(2), x(3), ...., x(k)`
such that:

`x(k) < x(k-1) < ... < x(2) < x(1)`

with the final list starts with `x(k)`. Since `for 1 <= i < k, x(k) < x(i)`
from the transitivity rule and the asymmetry rule, we know that
`for 1 <= i < k, not (x(i) < x(k))`.

And for any other element `y`, either it is `not y < x(1)` or `not y < x(2)`,
..., or `(not y < x(k))`, if we assume that `(not y < x(i)), 1 <= i <= k`, then
since `x(k) < x(i)`, we know that `(not y < x(k))` (as per the transitivity rule
again). So, in summary, for any element `z` other than `x(k)`, `not (z < x(k))`:

```
After the first iteration:
x(k) ... ...
    |-------|
    each z: not (z < x(k))
```

So if we recursive with the same reasoning, we get:

- For any element `x` in the sorted list, every element `y` after it
  satisfies `not (y < x)`, exactly what we want.

## Strict Partial Order

If we dig into math literature, a relation with asymmetry, transitivity and
(implied) irreflexivity is called a [**strict partial order**](https://en.wikipedia.org/wiki/Partially_ordered_set#Strict_partial_orders).

# Quick Sort (with Hoare Partition)

Let's look at another common sort algorithm, quick sort, as originally proposed
by Hoare.

It is conceptually very simple: we select an element `p` and permute the list
so that everything `< p` is before `p` and everything `not (< p)` is after `p`
(the partition). Then we recursive into the two unsorted part.

## The Partition

Specifically, the partition starts with selecting an "pivot" element `p`, and
having two arrows pointing towards the start and the end of the list:

```
... ... p ... ...
↑               ↑
L               R
```

Then, we continuously move the left arrow one element to the right if the pointed
element `< p`. Likewise, we move the right arrow as long as `p <` the pointed
element. When both arrows stop, we swap the elements pointed by the two arrows.
We continue doing this until the two arrows cross each other.

## Skipped

Now, if we look into those "skipped" elements on both sides:

```
...x...p...y...
```

We only know that `(x < p) and (p < y)`, we skip them because we conclude that
their current positioning does not violate the property we want, i.e.:

```
not (p < x) and
not (y < p) and
not (y < x)
```

It seems that we assume exactly the same thing as before, i.e. asymmetry, which
gives us `not (p < x) and not (y < p)` and transitivity, which gives us
`not (y < x)`.

## Swapped

Cool, let's add the two rules to our tool kit and look into the two swapped
elements:

```
...x...p...y...
after swap:
...y...p...x...
```

We only know that `(not (x < p)) and (not (p < y))`, but we conclude that:

```
not (p < y) and
not (x < p) and
not (x < y)
```

So the first two conclusion follows directly from our precondition, it's the
third one that we "jump" to with unclear assumptions.

OK, our precondition seems rather unhelpful, let's break it down:

(Let's denote `not (x < y) and not (y < x)` with `x !<> y`, or `y !<> x`)

1. If it is actually `(p < x) and (y < p)`, then with asymmetry and transitivity
   we can already reach the `not (x < y)` above.
2. If it is actually `(p < x) and (p !<> y)`, it turns out this also gives us
   `not (x < y)` with asymmetry and transitivity, to see this, note that:

   ```
   A and B => C
   <=>
   (not C) and A => not B
   ```

   So we need to prove `(x < y) and (p < x) => (p < y) or (y < p)`, which follows from
   transitivity.
3. If it is actually `(p !<> x) and (y < p)`, this gives us `not (x < y)` using the
   same reasoning above.
4. If it is actually `(p !<> x) and (p !<> y)`, well, in this case, reaching
   `not (x < y)` actually seems like there is still an assumption unknown.

So, in summary, we seem to have some assumption under which
`(p !<> x) and (p !<> y) => not (x < y)` is true.
Without this, it's still possible that `x < y`, so we would have to check this
before swapping.

Now, if we expand `not (x < y)` to `(y < x) or (x !<> y)`, it becomes clear that
`(p !<> x) and (p !<> y) => (x !<> y)` (i.e. transitivity of the incomparability
relation) could be our assumption here.

If we go down from this abstract level and simply have real numbers and their
normal comparing rules, we will see that the case 4 above is actually when
`p == x` and `p == y`, so naturally we would have `x == y` so swapping them would
not violate the no `after < before` (now it's also `before <= after`) rule.

Actually, the `!<>` relation we just defined, is symmetric, reflexive (as per
the definition), and with transitivity, is unsurprisingly called a
**equivalence relation**.

## Strict Weak Ordering

It turns out, in math literature, a strict partial order with transitivity of the
incomparability relation is called a [**strict weak order**](https://en.wikipedia.org/wiki/Weak_ordering#Strict_weak_orderings), exactly what C++
[`std::sort` requires our custom comparator function to define](https://eel.is/c++draft/alg.sorting#general-3).

Transitivity of incomparability gives us the ability to group `a`, `b` and `c`
if `a !<> b` and `b !<> c`, without checking the relationship of `a` and `c`,
thus possibly reducing the required amount of computation.

Let's say that through this incomparability relation, we have grouped all elements
into three groups, where each group includes all elements that is `!<>` the first
element, and thus for any element `x` and `y` inside a group, `x !<> y`, and for
any element `x` inside a group and any element `y` outside of the group,
`not (x !<> y)`, i.e. `x < y or y < x`:

```
{a, b}
{c, d, e}
{f, g}
```

Now since elements from different group must be related by `<`, let's say we have
`a < c`, then it's not possible that `c < b` or `d < a`, as otherwise we would get
`a < b` and `d < c`. By the same reasoning, any element in the `a` group would be
`<` any element from the `c` group. So if we have `a < c < f`, we can order our
groups like this:

```
{a, b} <- {c, d, e} <- {f, g}
```

With transitivity of `<`, we know that any element from an earlier group would be
`<` any element from a later group, and since `<` is asymmetry, we also know that
there is no loop in this chain.

(More formally, the `<-` in our diagram is a **strict total order** on the set of
all equivalence classes defined by the equivalence realtion `!<>`).

So with strict weak ordering, we have this nice-looking chain of order.

# Inspiration

- [An URLO dicussion](https://users.rust-lang.org/t/too-severe-precondition-for-slice-sort-by/131953)
- [Order I Say!](https://web.archive.org/web/20120422220137/http://cpp-next.com/archive/2010/02/order-i-say/)
