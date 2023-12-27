+++
title="Rust - Exploring Lifetime Problems - 3"
description="How should we understand this?"
date=2023-12-27

[taxonomies]
tags = ["rust-language", "rust-lifetime"]
categories = ["rust"]
+++

I hit this lifetime problem when trying to change a mutable reference itself:

```rust
struct St<'a>(&'a mut [usize])

impl<'a> St<'a> {
    fn change<'some_lifetime>(&'some_lifetime mut self) {
        // The compiler complains that 'some_lifetime should be
        // as long as 'a:
        self.0 = &mut self.0[1..];
    }
}
```

But changing a shared reference is fine:

```rust
struct St<'a>(&'a [usize])

impl<'a> St<'a> {
    fn change<'some_lifetime>(&'some_lifetime mut self) {
        // Works:
        self.0 = &self.0[1..];
    }
}
```

Let's see the first case `self.0 = &mut self.0[1..]`, the left side expects a `&'b mut [usize]`,
the right side is actually `std::ops::IndexMut::index_mut(self.0, 1..)`, note that since `self.0`
is of type `&mut T` which *is not* `Copy`, there is an implicit reborrow: `index_mut(&mut *self.0, 1..)`,
which basically creates another temporary `&'temp mut [usize]`, since it is created to be used inside
the function, we have `'some_lifetime: 'temp`, but `'temp` has to be `'b` to satisfy the left side, so
we now must have `'some_lifetime: 'b`.

In the second case, the line expands to `self.0 = std::ops::Index::index(self.0, 1..)` `self.0` is of type
`&T` which *is* `Copy`, so the complication above does not come up.

One way to solve the problem in the first case without requiring `&some_lifetime: 'b` is to move the exclusive
reference out using `std::mem::{take,replace,swap}`:

```rust
struct St<'a>(&'a mut [usize])

impl<'a> St<'a> {
    fn change<'some_lifetime>(&'some_lifetime mut self) {
        // since `&mut [T]` implements `Default` (with default value `&mut []`),
        // we can use `std::mem::take`:
        let r_mut = std::mem::take(&mut self.0);
        self.0 = std::ops::IndexMut::index_mut(r_mut, 1..);
    }
}
```
