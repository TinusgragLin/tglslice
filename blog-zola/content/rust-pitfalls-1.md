+++
title="Rust - Pitfalls - 1"
description="You may not expect the result."
date=2024-01-01

[taxonomies]
tags = ["rust-language", "rust-pitfalls"]
categories = ["rust"]

[extra]
ToC=true
+++

# Function Call Argument Evaluation and Inlining-enabled Optimization

Arguments passed to a function are generally evaluated first before calling the
function, and if the function is inlined (i.e. the compiler can see what's inside
the function), the compiler can do optimizations that are against the original
intention. The following code might seem perfectly valid:

```rust
#[repr(u8)]
enum En {
    N1 = 0,
    N2 = 1,
}

/// Return `Some(val)` if the condition holds, `None` otherwise.
fn my_then_some(condition: bool, val: En) -> Option<En> {
    if condition { Some(val) } else { None }
}

impl En {
    /// # Safety
    /// The caller should guarantee that `val` is less than 2.
    unsafe fn from_u8_unchecked(val: u8) -> Self {
        std::mem::transmute(val)
    }

    #[inline(never)]
    fn from_val(val: u8) -> Option<En> {
        my_then_some(val < 2, unsafe { En::from_u8_unchecked(val) })
    }
}
```

But if you build it in release mode (`--release`) and check the assembly code,
`En::from_val` is simply `mov eax, edi` (Intel style syntax), i.e. it simply
returns the only argument as is, without any checking.

The reason is two fold, first, passing expressions to function as arguments is
equivalent to evaluate these expressions first, and then call the function with
the evaluated values, `from_val` is actually:

```rust
let condition = val < 2;
let en = unsafe { En::from_u8_unchecked(val) }
my_then_some(condition, en)
```

And second, `En::from_u8_unchecked` and `my_then_some` are very small functions, so
after inlining both of them, we get:

```rust
let condition = val < 2;
let en = unsafe { std::mem::transmute(val) }
if condition { Some(en) } else { None }
```

Now the compiler is able to see that we unconditionally use `val: u8` as `En`, and
it assumes that you know what you are doing: the resulting `En` is completely valid
i.e. it is either `En::N1` (`0`) or `En::N2` (`1`), since that `En` is just `val`,
`val` must also be either 0 or 1! No need to compute `condition`, it must be `true`!
`if condition { Some(en) } else { None }` is simply `Some(en)`, this function can not
even return `None`!

Just imagine how happy the compiler is, it can reduce the original `from_val` to just:

```rust
fn from_val(val: u8) -> En { std::mem::transmute(val) }
```

The function call expansion and two inlinings pushes the compiler to drastically optimize
`from_val` to just an identity function. Without the inlining of `En::from_u8_unchecked`,
the problem is avoided since the compiler won't know what `val` is, but if only `my_then_some`
is not inlined, the behavior will still be incorrect: the only use of `my_then_some` is
inside `from_val`, and with the inlining of `En::from_u8_unchecked`, the compiler knows
the the `condition` passed to `my_then_some` is always true, so only `my_then_some(true, ...)`
is needed, so `my_then_some` again becomes an identity function.

However, after the function call expansion, it's clear that we should not construct a `En`
from `val` without checking the condition first, it is, actually, **our fault**.

Side note: If you disable the inlining of `En::from_u8_unchecked` and check the correct
`En::from_val` assembly, you will see that 2, an invalid value of `En`, is used as the
`None` case:

```assembly
test1::En::from_val:
 push    rbx
 mov     ebx, edi
 call    test1::En::from_u8_unchecked
 cmp     bl, 2
 movzx   ecx, al
 mov     eax, 2
 cmovb   eax, ecx
 pop     rbx
 ret
```
