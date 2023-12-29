+++
title="Rust - Subtyping and Variance"
description="How should we understand this?"
date=2023-05-31
updated=2023-12-29

[taxonomies]
tags = ["rust-language", "rust-lifetime", "rust-type-system"]
categories = ["rust"]
+++

# Subtyping

Subtyping is the situation where values of type `A` can be used as values of type `B`, type `A`
is then called a subtype of type `B`, or, conversely, type `A` is called a supertype of type `B`.
People often express this relationship as 'a value of type `A` is (also) a value of type `B`'.

This definition of subtyping directly gives one major use of it, another one is when
a value of type `B` is produced, it can be binded to a variable of any supertype of `B`.
In short, this type hierarchy gives us the ability to not just *be more specific*, but also
*be more general*.

Basic subtyping relationships can arise in the following cases:

## Case1: Lifetime related

A lifetime `'a` is a subtype of `'b` if the duration of `'a` covers that of `'b`, this is
written as `'a: 'b`.

## Case2: Trait related

### Super-trait Induced

A super-trait `SupTrait` of a trait `Trait` is a trait that a type must implement before it
can implement `Trait`, in other word, any type implement `SupTrait` is also a type implement
`Trait`, this is again written as `SupTrait: Trait`.

Now consider a type representing *some unknown type* that implements `SupTrait` (i.e. a `dyn SupTrait`),
since this unknown type must also implements `Trait`, it is also *some unknown type* that implements
`Trait` (i.e. a `dyn Trait`), thus `dyn SupTrait` is also a subtype of `dyn Trait`.

### Higher-ranked Trait Bound (HRTB) Induced

Values of a type that implements `Trait<T>` for all `T` can, of course, be used as values of a type
that only implements `Trait<Cat>`, i.e. `dyn for<T> Trait<T>` is a subtype of `dyn Trait<SomeT>`.

## Subtyping Property of Parametric Generic Types: Variance

> Variance is a property that type constructors have with respect to their arguments.

A type constructor is any generic type with some arguments, e.g. `Vec<T>`, `& 'lifetime T`,
`&mut 'lifetime T`. Let's say `C<T>` is a type constructor with argument `T`, and type `Sub`
is a subtype of some type `Super`, then:

- `C<T>` is covariant over `T` if `C<Sub>` is a subtype of `C<Super>`
- `C<T>` is contravariant over `T` if `C<Super>` is a subtype of `C<Sub>`
- `C<T>` is invariant over `T` if there is no subtyping relationship between `C<Super>` and
  `C<Sub>`.

---

For example, in Rust, `&'a T` is covariant over both `'a` and `T`, and `&'a mut T` is covariant
over `'a`, *but* **invariant** over `T`. This is because, first, *contravariance* doesn't make
sense here; second, if it's covariant over `T`, then a function accepting a `&mut Animal` and
turning the `Animal` to a `Dog` internally can turn a `Cat` into a `Dog` since `&mut Cat` is
be a subtype of `&mut Animal`!

Now looking back at `&'a T`, it is covariant over `T`, is this safe given that Rust has all these
standard interior mutability wrappers (`Cell`, `RefCell`, ...)? That is, can we use a `&'a RefCell<Cat>`
to turn the cat into a dog? Well, first, `&'a RefCell<Cat>` is covariant over `RefCell<Cat>`, and,
the covariance chain has to stop here, `RefCell<T>` cannot be covariant over `T`. Indeed, the base
of all interior mutability wrapper types in Rust, the `UnsafeCell<T>`, is invariant over `T`, and
so does all these derived types, giving us the safety we want.

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

Notice also that, `dyn Trait<T>` is also invariant over `T`, the argument for this is similar to
what we have discussed: `&dyn Trait<T>` is covariant over `dyn Trait<T>`, and `dyn Trait<T>` might
contain interior mutabilities, so it's possible that a `&dyn Trait<T>` acts like a `&mut T`, so
`dyn Trait<T>` can not be covariant over `T`, otherwise, you will be able to do the following:

```rust
trait Trait<T> {
    fn change_to(&self, val: T);
}

struct CatHouse(Cell<Cat>)

impl Trait<Cat> for CatHouse {
    fn change_to(&self, val: Cat) {
        // In this impl, `T` in `Trait<T>` is simply `Cat`,
        // how can anything go wrong?
        self.0.set(val)
    }
}

let cat_house = CatHouse(Cell::new(Cat::new()));

// if `dyn Trait<T>` is covariant over `T`, this is possible:
let r: &dyn Trait<Animal> = &cat_house;

to_dog(r);
// !!! Now inside our cat house lives a dog!

fn to_dog(r: &dyn Trait<Animal>) {
    // Here `T` in `Trait<T>` can be any animal!
    // Since a `Dog` is a `Animal`, and the function is
    // expecting a `Animal`, surely nothing can go wrong!
    r.change_to(Dog::new());
}

```
---

References:
- Rustnomicon - [Subtyping](https://doc.rust-lang.org/nomicon/subtyping.html)
- Reference - [Subtyping](https://doc.rust-lang.org/reference/subtyping.html)
- [Crust of Rust: Subtyping and Variance](https://www.youtube.com/watch?v=iVYWDIW71jk)
- RFC Book - [HRTB](https://rust-lang.github.io/rfcs/0387-higher-ranked-trait-bounds.html#subtyping-of-trait-references)
