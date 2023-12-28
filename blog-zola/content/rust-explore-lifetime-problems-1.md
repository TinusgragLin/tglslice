+++
title="Rust - Exploring Lifetime Problems - 1"
description="How should we understand this?"
date=2023-01-22
updated=2023-12-28

[taxonomies]
tags = ["rust-language", "rust-lifetime"]
categories = ["rust"]
+++

The following code snippet is adapted from an example from [this blog post](http://zderadicka.eu/higher-rank/):

```rust
trait Checksum<R: Read> {
    fn calc(&self, r: R) -> Vec<u8>;
}

struct XorChecksum;
impl<'a> Checksum<&'a [u8]> for XorChecksum {
    fn calc(&self, r: &'a [u8]) -> Vec<u8> { todo!() }
}

fn main() {
    let mut buf = [0u8; 8];
    let xor_checker = XorChecksum;
    let checker: &dyn Checksum<&[u8]> = &xor_checker;
    // Type: &'l1 dyn (Checksum<&'l2 [u8]> + 'l3)
    // 1.'l3: 'l1
    // 2.'l2: 'l3
    // => 'l2: 'l1
    //
    // -------------------------------------------
    // Type: &'l1 Xor
    //
    // -------------------------------------------
    // Type: &'l1 Xor<'l2>
    // 1.'Xor<'l2>: 'l1
    // 2.'l2: 'Xor<'l2>
    // => 'l2: 'l1
    checker.calc(&buf[1..]); // immutable borrow occurs here
    &mut buf;                // can not mutably borrow!
    checker;                 // immutable borrow used here
}
```

My analysis is as follows:

`checker` is of type `&'l1 (dyn Checksum<&'l2 [u8]> + 'l3)`, since for any `&'l T`,
`T: 'l`, we have `'l3: 'l1`. And for any `T` that implements `Checksum<&'l2 [u8]>`,
`'l2: T`, so we have `'l2: 'l3`. Thus `'l2: 'l1`, i.e. the `&[u8]` this `checker` internally
borrows lives as long as `checker`.

Now looking back at the `dyn Checksum<&'l2 [u8]>` part, we seem to demand a type that implements
`Checksum<&'l2 [u8]>` for some specific fixed `'l2`, the checker becomes a checker for some
specific `&[u8]`, but what we want is actually a checker for any `&[u8]`:

```rust
let checker: &dyn for<'a> Checksum<&'a [u8]> = &xor_checker;
```

Indeed, the `impl Checksum` block for `XorChecksum` is actually defining `XorChecksum`'s `Checksum`
implementation for any `&'a [u8]`:

```rust
impl<'a> Checksum<&'a [u8]> for XorChecksum { .. }
```

So it is a `dyn for<'a> Checksum<&'a [u8]>`. And since a checker for any `&[u8]` would work
for a specific `&[u8]`, it is also a `dyn Checksum<&'l [u8]>`.
