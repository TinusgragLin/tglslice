+++
title="Rust - Exploring Lifetime Problems - 1"
description="How should we understand this?"
date=2023-01-22

[taxonomies]
tags = ["rust-language", "rust-lifetime"]
categories = ["rust"]
+++

The following code snippet is adapted from an example from [this blog post](http://zderadicka.eu/higher-rank/):

```rust
use std::io::Read;

trait Checksum<R: Read> {
    fn calc(&self, r: R) -> Vec<u8>;
}

struct Xor;
impl<'a> Checksum<&'a [u8]> for Xor {
    fn calc(&self, r: &'a [u8]) -> Vec<u8> { todo!() }
}

fn main() {
    let mut buf = [0u8; 8];
    let mut xor = Xor;
    let checker: &dyn Checksum<&[u8]> = &xor;
    let mut data = "Sedm lumpu slohlo pumpu za uplnku".as_bytes();
    loop {
        let n = data.read(&mut buf).unwrap();   // line X
        if n == 0 { break }
        checker.calc(&buf[..n]);                // line Y
    }
}
```

This does not compile, the compiler complains that the immutable reference acquired at line Y might survive across iterations, thus we can not get a mutable reference to the same object at line X.

Is this complaint reasonable? It probably is, since `checker` is just a trait object and thus gives little information about the underlying concrete type, one can argue that the actual type of `checker` might be a `struct` that has some interior mutability and sets one of its field to the passed-in immutable reference in its `calc` associated function.

To confirm that the compiler does has this kind of concern, we can make `checker` has a concrete type by removing the type annotation:

```rust
...
    let checker /*: &dyn Checksum<&[u8]>*/ = &xor;
...
```

Now `Xor` does not seem to have any interior mutability and thus its `calc` is not likely to store the passed-in reference, thus the code snippet now compiles.

But what if `Xor` does have some interior mutability? Let's change `Xor`:

```rust
...
struct Xor<'a> {
    c: Option<std::cell::Cell<&'a i32>>
}
impl<'a> Checksum<&'a [u8]> for Xor<'a> {
    fn calc(&self, r: &'a [u8]) -> Vec<u8> {
        todo!()
    }
}
...
```

This change make the code not compile, if we delete the `Cell` wrapper, the code compiles again. This means the compiler does notice the interior mutability issue.

I also noticed that I used the same lifetime parameter for `Checksum<&'lifetime [u8]>` and `Xor<'lifetime>`, this basically means that whatever reference `calc` takes, it must live at long as the `Xor` itself, which definitely make the matter worse. What if we add another lifetime parameter and sets the lifetime for `Xor` itself and the lifetime for the argument of `calc` apart? Since the `Checksum` trait requires that the type argument of `Checksum` and the type of `r` in `calc` are the same, there is only one way to do that:

```rust
...
struct Xor<'xor> {
    c: Option<std::cell::Cell<&'xor i32>>
}
impl<'x, 'r> Checksum<&'r [u8]> for Xor<'x> {
    fn calc(&self, r: &'r [u8]) -> Vec<u8> {
        todo!()
    }
}
...
```

This basically says: for all `Xor`s that has a lifetime of `'xor`, it implements `Checksum` trait for a `&[u8]` with any lifetime `'r`.

Now this change basically makes the lifetime of `Xor` and the argument of `calc` unrelated except for the obvious requirement that they must overlap (otherwise we will not be able to make the call). 

Surprisingly, the above change makes the code compiles again, even though `Xor` still has interior mutability. This becomes reasonable if you dive a little deeper into the aforementioned reversed reference problem, for the passed-in reference to be stored, the `calc` must contain something like `self.field = r`, the left hand side should be like `&'xor T`, while the right hand side is `&'r T`, for this assignment to valid, this must be the case that `'r: 'xor`, that is, `'r` is at least as long as `'xor`. And the above code contains no such guarantee.

To prove this, I added this bound `'r: 'x` to the impl block, and yes, it doesn't compile after adding this:

```rust
...
impl<'x, 'r> Checksum<&'r [u8]> for Xor<'x> where 'r: 'x {
...
```

But if you change this bound to `'x: 'r`, it compiles again!

Now come back to the original problem, we probably know what goes wrong: the two lifetime within the `checker` type `&'checker Checksum<&'r [u8]>` might be related in a way such that it allows `calc` to store the input reference:

```rust
...
    let checker: &dyn Checksum<&[u8]> = &xor;   // It is you, am I right?
...
```

so we again need to make the two lifetime less related, we can use higher-kind trait bound for this:

```rust
...
    let checker: &dyn for<'r> Checksum<&'r [u8]> = &xor;   // Got ye!
...
```

Now what is `checker`? It is a reference to any type that implements `Checksum` trait for a `&[u8]` with any lifetime `'r`. And if it is any lifetime `'r`, there is no way some function can do `self.field = input_reference` since this requires that `'r` outlives self.

And now it compiles!
