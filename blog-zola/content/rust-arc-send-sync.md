+++
title="Rust - Arc Send and Sync Problem"
description="Why `Arc<T>` requires that `T` is `Send + Sync` for itself to be `Send` or `Sync`?"
date=2023-02-22

[taxonomies]
tags = ["rust-language", "rust-async"]
categories = ["rust"]
+++

All of this has to do with what `Arc<T>` can do:
1. You only need a shared reference to `Arc<T>` to clone a `Arc<T>`, that is, to gain a shared reference to `T`.
2. For a ref-counted (shared) reference system, the thread responsible for dropping the real `Arc<T>`, thus dropping `T`, might not be the thread originally own the `T`,
   and a thread can only drop what is inside its own local storage, thus `T` might need to be moved across threads.

Thus for a `&Arc<T>` to be `Send`, `T` needs to be `Sync` to allow multiple threads effectively holding a shared reference to `T`, and `T` also needs to be `Send` to allow
any thread to be able to drop the whole `Arc` system when appropriable.

And since `Arc<T>` is `Sync` iff `&Arc<T>` is `Send`, the same thing goes when `Arc<T>` needs to be `Sync`.
