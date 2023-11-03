+++
title="Rust - Exploring Lifetime Problems - 2"
description="How should we understand this?"
date=2023-02-28

[taxonomies]
tags = ["rust-language", "rust-lifetime"]
categories = ["rust"]
+++

The following code snippet is a abbreviated demonstration of a problem I have encountered in my project:

```rust
struct Inner1;
struct Inner2;

struct S {
    inner1: Inner1, 
    inner2: Inner2
}

impl S {
    fn as_inner2_ref(&self) -> &Inner2 {
        &self.inner2
    }

    fn let_us_test(&mut self) {
        let i1 = &mut self.inner1;

        // &self.inner2;            // A
        // self.as_inner2_ref();    // B

        i1;
    }
}
```

In this code snippet, using line B makes the compiler complains that you mutable and immutable references to `self` can not coexist,
while using line A satisfies the compiler. This seems weird at first, since line A and B does exactly the same thing! Or, is this what
the compiler think?

On closer investigation, we will be able to find that this is not the case: line A explicitly states that it wants only a mutable references
to `self.inner` while line B calls a function that needs a mutable reference to the whole `self`, so in the first case the compiler knows 
that `i1` is a mutable reference to only `self.inner1`, and during the lifetime of `i1`, a mutable reference to only `self.inner2` is created,
which is fine, but in the second case, since the compiler will not try to understand what `as_inner2_ref` does, the compiler reasonably assumes
`as_inner2_ref` refers/touches the whole `self`, after all, it is written in the signature: `&self`, thus the compiler is unhappy because there
might be both a mutable and immutable references to `self.inner1`.

This example seems simple, what I have encountered, though has the same reasoning, is a little bit of hard to spot the heart of the problem:

```rust
    fn let_us_test_2(self: std::pin::Pin<&mut Self>) {
        let i1 = &mut self.inner1;

        &self.inner2;

        i1;
    }
```

Notice that this time we use line A but change the type of `self` from `&mut Self` to `Pin<&mut self>`, it will again not compile. The problem is
that the reason that we can still use `self.inner1` is because `Pin<Deref<T>>`/`Pin<DerefMut<T>>` implments `Deref<T>`/`DerefMut<T>`, and 
`deref`/`deref_mut` takes a immutable/mutable reference to `Self`, which means the above code is really:

```rust
    fn let_us_test_2(self: std::pin::Pin<&mut Self>) {
        let i1 = &mut Pin::deref_mut(&mut self).inner1;

        &Pin::deref(&self).inner2;

        i1;
    }
```

Bang! A mutable and an immutable reference to `Self` can not coexist! To solve this, we just need to try making it explicit that the two part really
needs two different part of `self`:

```rust
    fn let_us_test_2(self: std::pin::Pin<&mut Self>) {
        let mut_ref = self.deref_mut(); // &mut Self
        let i1 = &mut mut_ref.inner1;   // this touches only self.inner1

        &mut_ref.inner2;                // this touches only self.inner2

        i1;
    }
```
