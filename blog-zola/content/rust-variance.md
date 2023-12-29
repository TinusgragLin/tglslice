+++
title="Rust - Subtyping and Variance"
description="How should we understand this?"
date=2023-05-31
updated=2023-12-29

[taxonomies]
tags = ["rust-language", "rust-lifetime", "rust-type-system"]
categories = ["rust"]
+++

Subtyping: The situation where a subtype of a type can be used as that type.

This definition of subtyping directly gives one major use of it, another one is when
a value of type `A` is produced, it can be binded to a variable of any supertype of `A`.
In short, this type hierarchy gives us the ability to not just *be more specific*, but also
*be more general*.

> Variance is a property that type constructors have with respect to their arguments.

A type constructor is any generic type with some arguments, e.g. `Vec<T>`, `& 'lifetime T`,
`&mut 'lifetime T`. Let's say `C<T>` is a type constructor with argument `T`, and type `Sub`
is a subtype of some type `Super`, then:

- `C<T>` is covariant over `T` if `C<Sub>` is a subtype of `C<Super>`
- `C<T>` is contravariant over `T` if `C<Super>` is a subtype of `C<Sub>`
- `C<T>` is invariant over `T` if there is no subtyping relationship between `C<Super>` and
  `C<Sub>`.

---

For example, `&'a mut T` is covariant over `'a`, invariant over `T`. `&'a mut T` is invariant
over `T`, not covariant, because if it is the case, then suppose now you can have a function
accepting a mutable reference to `Animal` and turing it to be a `Dog` (this is possible since
`Dog` is a subtype of `Animal`), you then can make a `Cat`, pass it to this function (this is
possible if `&'a mut T` is covariant over `T`, which indicates that `&mut Cat` is a subtype of 
`&mut Animial`), and suddenly, the cat you just constructed now becomes a dog!

Generally, any `C<T>` through which you can mutate the `T` that either is directly contained
inside the `C<T>` or indirectly pointed to by some kind of pointer, should not be covariant
over `T`, because, again, if this is the case, you can pass a `C<Sub>` to a function accepting
a `C<Super>`, which may alter the `Super` to be something of any sub type of `Super`. You would
then get a `C<Dog>` out of `C<Cat>`. (`T` can be thought as an 'input type' of `C<T>` in this 
case)

On the other hand, if `C<T>` does not contain a `T` nor it points to a `T` which it can mutate,
e.g. in the case of a `Deserializer<T>`, which `T` is just the type of something its associated
function can produce, then it is safe to make it covariant over `T`. 

---

The only contravariance case pops out when we consider the relationship between a function's type
and the types of its arguments. Say we need a `fn(Cat) -> ...`, since this function expects a `Cat`,
any value of `Cat` type or any subtype can be used, so a `fn(BlackCat) -> ...` won't satisfy our
need, but a `fn(Animal) -> ...` is a valid option. On the other hand, a function that gives out a `Cat`
is surely a function that gives out a `Animial`, which is why `fn() -> T` is covariant over `T`.

This is probably why in C# and Kotlin, you mark a generic type with `out` to indicates that the
outter class/type is covariant over that generic type, `in` to indicates the contravariant case.

---

Here is a table summarizing variance properties of some basic types in Rust [from the reference](https://doc.rust-lang.org/reference/subtyping.html#variance):

|Type                        |Variance in 'a |Variance in T|
|----------------------------|---------------|-------------|
|&'a T                       |covariant      |covariant    |
|&'a mut T                   |covariant      |invariant    |
|*const T                    |               |covariant    |
|*mut T                      |               |invariant    |
|[T] and [T; n]              |               |covariant    |
|fn() -> T                   |               |covariant    |
|fn(T) -> ()                 |               |contravariant|
|std::cell::UnsafeCell<T>    |               |invariant    |
|std::marker::PhantomData<T> |               |covariant    |
|dyn Trait<T> + 'a           |covariant      |invariant    |

Notice that, `&'a T`, `&'a mut T` and `dyn Trait + 'a` are all covariant over the lifetime `'a`, so whenever
a `&'short T`, `&'short mut T` or `dyn Trait + 'short` is needed, a `&'long T`, `&'long mut T` or `dyn Trait + 'long`
can be used:

```rust
struct St<'a>(&'a str)

impl<'a> St<'a> {
    fn new(s: &'a str) -> Self { St(s) }
    fn replace(&mut self, s: &'a str) { self.0 = s }
}

static SECOND: &'static str = "Second";

fn main() {
    let s = String::from("First");
    let mut st = St::new(&s);
    st.replace(SECOND); // Works!
}
```

Or, whenever a `&'long T`, `&'long mut T` or `dyn Trait + 'long` is produced, they can be binded to a `&'short T`,
`&'short mut T` or `dyn Trait + 'short` variable, it is sometimes said that the compiler has automatically **shorten**
the lifetime in these cases.

---

References:
- Rustnomicon - [Subtyping](https://doc.rust-lang.org/nomicon/subtyping.html)
- Reference - [Subtyping](https://doc.rust-lang.org/reference/subtyping.html)
- [Crust of Rust: Subtyping and Variance](https://www.youtube.com/watch?v=iVYWDIW71jk)
