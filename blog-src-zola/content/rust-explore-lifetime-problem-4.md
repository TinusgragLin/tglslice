+++
title="Rust - Exploring Lifetime Problem - 4"
description="The drop check."
date=2024-01-02
updated=2024-01-04

[taxonomies]
tags = ["rust-language", "rust-lifetime", "rust-dropck"]
categories = ["rust"]
+++

The following example is taken from [Rustnomicon - Drop Check](https://doc.rust-lang.org/nomicon/dropck.html):

```rust
struct Inspector<'a>(&'a u8);

struct World<'a> {
    inspector: Option<Inspector<'a>>,
    days: u8,
}

impl<'a> Drop for Inspector<'a> {
    // Here we must have: `'a ⊃ 'inspector` for `drop` to be safe.
    // Particularly, if `'a == 'static`, it is always safe to call
    // this `drop`, that's because `Drop::drop` won't be called for
    // static items, so `'inspector` must not be ''static', thus
    // `'static ⊃  'inspector`.
    fn drop(&mut self) {
    }
}

fn main() {
    static L: u8 = 45;
    let n = 34;
    let mut world = World {
        inspector: None,
        days: 78,
    };
    let m = 67;

    // 1. Error, here `'a == 'world.days`:
    world.inspector = Some(Inspector(&world.days));

    // 2. Error, here `'a == 'm`, since `m` is dropped before `world`,
    // we have `'world ⊃ 'm`:
    // world.inspector = Some(Inspector(&m));

    // 3. Works, here `'a == 'n`, since `world` is dropped before `n`,
    // we have `'n ⊃ 'world`:
    // world.inspector = Some(Inspector(&n));

    // 4. Works, here `'a == 'static`:
    // world.inspector = Some(Inspector(&L));
}
```

The essence of this problem is simple: since the implementation of `Drop::drop` for
`Inspector<'a>` may inspect its contained `&'a u8` and the compiler isn't interested
in examine this, it requires that `'a` must *strictly outlive* (denoted by `⊃ `)
`'inspector` for the implementation to be safe. The general rule is:

> For a generic type to soundly implement drop, its generics arguments must strictly
> outlive it.

The detailed drop check rule is mentioned [here](https://doc.rust-lang.org/std/ops/trait.Drop.html#drop-check).

---

However, when we know that our `drop` implementation won't inspect any value it contains
that's deemed possibly dropped, this rule is too restricting. An escape hatch is the
`#[may_dangle]` marker that tells the compiler to skip one case when checking the
above rule:

```rust
unsafe impl<#[may_dangle] 'a> Drop for Inspector<'a> { ... }
```

The actual meaning of this marker is defined in the [RFC](https://rust-lang.github.io/rfcs/1327-dropck-param-eyepatch.html?highlight=1327#the-eyepatch-attribute):

> When used on a type, e.g. `#[may_dangle] T`, the programmer is asserting the only uses
> of values of that type will be to move or drop them. Thus, no fields will be accessed
> nor methods called on values of such a type (apart from any access performed by the
> destructor for the type when the values are dropped).
>
> When used on a lifetime, e.g. `#[may_dangle] 'a`, the programmer is asserting that no
> data behind a reference of lifetime 'a will be accessed by the destructor.

---

At first, I was confused by the fact that even though it is [defined](https://doc.rust-lang.org/reference/destructors.html#destructors) that fields
in a `struct` is dropped in declaration order, the compiler is still unable to
conclude that `World.inspector` is dropped before `World.days`. And the Nomicon
only talks about how the compiler is unable to determine the drop order of elements
inside a `Vec`, which implements its own `Drop`. How does this explain that the
compiler is unable to decide whether the left `Vec` in a `(Vec<U>, Vec<V>)` has
a longer lifetime than the right one or not?

After [asking around](https://users.rust-lang.org/t/a-question-about-drop-check/104781/),
It might be that the compiler simply won't consider the struct/tuple fields drop
order **just like** it won't consider the drop order of elements in a `Vec`.
