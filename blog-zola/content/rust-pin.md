+++
title="About Rust's Pin"
description="My attempt to understand Rust's Pin."
date=2023-12-10
updated=2023-12-10

[taxonomies]
tags = ["rust-pin"]
categories = ["rust"]

[extra]
ToC=true
+++

# Understand `Pin<P>`

## The problem

Working with data types whose values might contain self-referential constructs
is dangerous: if a value of such type is read from a memory location and write
to a different memory location (let's call this *transfer* from now on) **as is**
after a self-referential construct has been formed, the value in the new location
may be considered invalid and continuing using it might cause serious problems.

## Before solving: when will a value be transfered in safe Rust?

### Implicit cases

A value in Rust *can* be transfered *as is* implicitly whenever it is used. Depending
on whether or not its type is `Copy`, you can either use it unlimited times or just
once. In the fisrt case, the value is said to be 'copied', in the latter case, the
value is said to be 'moved'. In both cases, whether or not the value is actually
transfered is determined by the compiler based on necessity analyses and optimization
options. If a transfer does take place, it's *always a byte-by-byte transfer*, there
currently lacks a way to customize these 'copy's and 'move's.

In Rust, the marker trait `Copy` is used to indicate that any value of a particular
type can be *duplicated as is*, thus the compiler is free to copy them around.

### Explicit cases

Explicitly, types can have public APIs that include this behavior. For example, you
can define a `duplicate()` function for a type to get a duplicate of a value.
Although in this case, you have the full freedom to the customize the behavior. Now
looking back at our problem, we indeed can make use of this freedom to avoid the
problematic byte-by-byte copy, however, there is another explicit way to transfer a
value *as is* in a more specific fashion:

Presenting the `core::mem` module, it has functions such as `take`, `replace` and `swap`
that transfer a value as is. These APIs do not assume the passed-in value can be duplicated
freely (i.e. its type is `Copy`), so doing a transfer either means destroying the original
value or refilling the original place with another value of the same type. As their
names imply, they take the second approach and all need `&mut T` to work.

## Solution 1: Customize

This problem can be solved if we can define custom behaviors making sure that the
value in the new location is valid **whenever** a value is transfered.

However, as we have seen in the pre-solving section, there's currently no way to do
this. So how can we safely work with self-referential values if we can not guarantee
the validity of a transfered value? Well, just don't transfer it at all!

## Solution 2: Restrict

Of course, we programmers are unreliable, it's better if the type system can
help.

One approach would be wrapping the value in a construct such that:

1. There is enough separation between the construct and the inner value, so
   that transfers of the construct itself do not trigger transfers of the
   inner value.
2. Accesses to the inner value are possible through the construct.
3. But it should not be possible to transfer a non-`Copy` inner value *unintended
   by any public APIs of the type* through these accesses in safe Rust **if** the
   value *can* be *intentionally* self-referential.

   The conditional part requires a way to tell a possibly intentionally
   self-referential type apart. (That's `Unpin`, or, more understandably, `NoNeedToPin`!)

   The restriction part might seem non-trivial, but if you go back to the pre-solving
   section, you would notice that, for non-`Copy` types, all the transfer done without
   public APIs of the type require either the ownership or a mutable reference of the
   value. As long as the construct provides no 'safe' way to give out these two, the
   desired restriction can be achieved.

Now if you only pay attention to the first 2 requirements, they look awfully like
descriptions for any pointer-like structures referring to the inner value! And
combining with the requirement 3, the desired pointer-like structure shouldn't
give the ownership or mutable references to the inner value.

Often, these structures internally contain the memory address of the pointed-to
value, which lives in stack or in heap. Values in stack, whose sizes should be
known at compile time, can be automatically managed with the help of the compiler.
Values in heap, whose sizes can be unknown in compile time, often requires manual
management. Luckily in Rust, `Box`, `Rc` (& `Arc`) are created for the programmers
to work with heap allocated values without caring about explicitly allocating and
freeing them.

So one question for our wrapping construct, which behaves like a pointer, is if the
inner value is in the heap, should it manage the allocation/freeing? If the answer is
yes, since `Box`, `Rc` or `Arc` already does management works, we certainly don't want
to redundant code for our construct. One simple solution immediately pops off: just wrap
them inside! Since there are many options for these managed pointers, we should make use
of generics:

```rust
struct Wrapper1<P: Deref> {
    p: P
}
```

If the answer is no, so the value is managed by a `Box`, `Rc` or `Arc` outside of
the construct, there immediately exist risks to dangling pointers. Dynamic checking
solutions rely on reference counting or garbage collection, `Box` uses neither. So
we're left with static checking using Rust's borrow system (i.e. `&'a T` and `&'a mut T`):

```rust
struct Wrapper2<'a, T> {
    p: &'a T
}
```

Notice that `Wrapper2` is simply a special case of `Wrapper1` since `&T` implements
`Deref`.

## `Pin<P>` in Rust

`Pin<P>` in Rust is much like the wrapper construct discussed above, but with one more
API requirement: once a value is wrapped inside a `Pin`, the value should never be
transfered until it reaches the end of its life. Note that this is not a API guarantee,
it's a requirement: when `P` is a managed pointer type, it can be guaranteed simply by
the use of the pointer type; otherwise, this requirement need to be guaranteed by us.

That's why the construction for `Pin<P>` when `P::Target` isn't known to be `Unpin` is
marked unsafe (`Pin::new_unchecked`): whether the requirement is met can't be checked by
the compiler.
