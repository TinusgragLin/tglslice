+++
title="O(1) Extra Space Iterative Binary Tree Traversal - Morris Traversal"
description="From the joy of no left sub-tree."
date=2024-01-09
updated=2024-01-11

[taxonomies]
tags = ["tree traversal"]
categories = ["algo"]

[extra]
ToC=true
+++

# Backgound: Traverse a Binary Tree without Recursion

Traverse a binary tree iteratively with an extra stack is known in early ages, in
1970s, Knuth gives an iterative traversal algorithm with 'tag' bits in nodes and
propose the problem of designing an alternative without explicit stack nor 'tag'
bits. In 1975, W.A. Burkhard came up with one that assumes all children nodes' address
is larger than the root. In 1979, Joseph M. Morris published his solution that
assumes nothing.

In the blog post, I will try to present (from my understanding) the key ideas of
[the 1975 paper](https://doi.org/10.1016/0020-0190(79)90068-1) and develop the
algorithm following the paper with these key ideas.

# Traverse a Right-skewed Tree (RST) is Too Easy

A right-skewed binary tree (right-skewed tree, or RST in the later discussion) is
a binary tree that always grows to the right.

To traverse a right-skewed tree is simply to traverse a singly linked list:

```c
void rst_in_order_traversal(Node *root) {
    Node *cur_root = root;
    while (cur_root != NULL) {
        if (cur_root.left == NULL) {
            visit(cur_root);
            cur_root = cur_root.right;
        } else {
            printf("Not a right-skewed tree!");
            return;
        }
    }
}
```

The first key idea of Morris traversal is just to transform a tree so that the
resulting tree has a lower left sub-tree but the same in-order traversal, keep
doing the transform until the resulting tree has no left sub-tree, so traversing
it is as simple as visit the root and traverse the right sub-tree.

# A Transform that Reduces the Left Sub-tree Height but Keeps the In-order Traversal

Before introducing the transform, a quick question: what is the last node in an
in-order traverse of a tree? The rightmost node, i.e. the furthest node in the
'always-right' path. When this node is visited, its left sub-tree is already visited,
and since it has no right sub-tree, its parent's whole right sub-tree is visited,
so its grandparent's whole right sub-tree is visited, this chain continues upwards,
and at the end, the root's whole right sub-tree is visited, so the entire tree is
visited.

So, for a binary tree, its in-order traversal is like this:

```
(left sub-tree in-order traversal) Root (right sub-tree in-order traversal)
==
(......................... RM_LST) Root (right sub-tree in-order traversal)
```

where `RM_LST` is the rightmost node of the left sub-tree (it it exists). But this is
equivalent to the case where the original `Root`'s left child is the root, and `RM_LST`
links to the original `Root` on the right, and the original `Root`'s left sub-tree is
empty. This is a transform that reduces the height of the left sub-tree of the tree we
are handling but keeps the in-order traversal.

With this transform, we can in-order traverse any tree by restructuring the tree when
necessary:

```c
void in_order_traversal(Node *root) {
    Node *cur_root = root;
    while (cur_root != NULL) {
        if (cur_root.left == NULL) {
            visit(cur_root);
            cur_root = cur_root.right;
        } else {
            // the left sub-tree is not empty!

            // find RM_LST:
            Node *p = cur_root.left;
            while (p.r != NULL) p = p.r;

            // do the transform:
            cur_root.left = NULL;
            p.r = cur_root;
            cur_root = cur_root.left;

            // after the transform, the left sub-tree is shorter by one level
        }
    }
}
```

Starting from the root, we check if the left sub-tree is empty, if yes, we happily visit
the root and go handle the right sub-tree, if no, we do the transform to reduce the height
of the left sub-tree and try again.

# Repair the Tree

## Only Add the Link

The repairing of the re-structurings of the above approach is very complax since we not
only add links but also delete original ones. The second key idea of Morris traversal is
that maybe we can just add a link from a `RM_LST`'s right side to the `Root`, but do not
delete the `Root`'s left link *as long as when handling the `Root`, we ignore its left sub-tree.*

## Determine a `Root`

But how do we know that a node is a `Root` in the transform process? Well, if its `RM_LST`'s
right link goes towards it. Notice that, examine whether a node is a `Root` requires us
to examine whether its `RM_LST` points to it, which, gives us an good opportunity to delete
the added link, repairing this one re-structuring. However, should we do that? What if
this re-structuring is still needed?

## When Should We Repair?

Looking back, the re-structuring happens exactly when the root's left sub-tree has to be
handled, at this kind of moment, we do 'turn to' the left sub-tree to handle it first, but
with an addition to the original tree structure: the rightmost node of the left sub-tree
now points to the root -- an addition to the left sub-tree of the original tree, to be exact.

Therefore when we are done with this left sub-tree, it's probably time that we repair the
destruction. When is the end of the traversal of this left sub-tree? Exactly when we
visit the `Root`, which, if you look back a little, is exactly when we can determine that a
node is the `Root`, since its left sub-tree is ignored. So yes, if we can determine that
a node is a `Root` by checking if its `RM_LST` points to it, we should do the repairing!

# The Final Code

```c
void in_order_traversal(Node *root) {
    Node *cur_root = root;
    while (cur_root != NULL) {
        if (cur_root.left == NULL) {
            visit(cur_root);
            cur_root = cur_root.right;
        } else {
            // The left sub-tree is not empty!

            // Find RM_LST (that either has been modified and has not been modified):
            Node *p = cur_root.left;
            while (p.r != NULL || p.r != cur_root) p = p.r;

            if (p.r == NULL) {
                // Get a RM_LST that has not been modified, we do the transform:
                p.r = cur_root;
                cur_root = cur_root.left;
            } else {
                // Get a RM_LST that has been modified, so we just find that `cur_root`
                // is a `Root`, we do the repairing:
                p.r = NULL;

                // We ignore the sub-tree of `cur_root` since it's a `Root`, visit the
                // root and turns to its right sub-tree:
                visit(cur_root);
                cur_root = cur_root.right;
            }
        }
    }
}
```

# Yet Another Way to Understand It

When in-order traverse a tree, if the left sub-tree is empty, we visit the root
and turns to the right sub-tree, if the left sub-tree is not empty, we have to
dive in to the left sub-tree first.

But before we dive in to the left sub-tree, make the last node to visit in the
left sub-tree (i.e. `RM_LST`) links to the root, so we automatically go back to
the root, and when we do go back to the root (i.e. when its `RM_LST` points to it),
the left sub-tree is done, so we delete the added link and turns to the right
sub-tree.

# Variations

## Pre-order

Pre-order traversal can also be done in this manner with one line of modification.
Although in pre-order case, the last node to visit in the left sub-tree isn't `RM_LST`,
link it towards the root still preserve the traversal order **if** we not only ignore
a `Root`'s left sub-tree, but also ignore the `Root` itself (i.e. do not visit) when
we meet one:

```c
void pre_order_traversal(Node *root) {
    Node *cur_root = root;
    while (cur_root != NULL) {
        if (cur_root.left == NULL) {
            visit(cur_root);
            cur_root = cur_root.right;
        } else {
            // The left sub-tree is not empty!

            // Find RM_LST (that either has been modified and has not been modified):
            Node *p = cur_root.left;
            while (p.r != NULL || p.r != cur_root) p = p.r;

            if (p.r == NULL) {
                // Get a RM_LST that has not been modified, we do the transform:
                p.r = cur_root;
                // Before we dive in to the left sub-tree, visit the root:
                visit(cur_root);
                cur_root = cur_root.left;
            } else {
                // Get a RM_LST that has been modified, so we just find that `cur_root`
                // is a `Root`, we do the repairing:
                p.r = NULL;

                // Since `cur_root` is a `Root`, it has been visited, we ignore it and its
                // left sub-tree, turn right to its right sub-tree:
                cur_root = cur_root.right;
            }
        }
    }
}
```

## Post-order

In post-order case, to make the transform still preserve the traversal order,
let's think about that in the original traversal, what would happen **when** the `RM_LST`
is being handled: first its left sub-tree is handled, and then itself get visited
since it has an empty right sub-tree. Now `RM_LST` is completely handled, so we go
back to its parent, since `RM_LST` is the right child of its parent, its parent is
immediately visited and completely handled, this chain continues to the left child of
the `Root`, in which moment the left sub-tree of the `Root` is completely handled, so
we now turn to the right sub-tree.

```
1. (RM_LST left sub-tree traversal)
2. RM_LST (RM_LST's Parent) (RM_LST's Grandparent) ... (Root's Left Child)
3. (Root's right sub-tree traversal) Root
```

For the transformed tree, the traversal order starting from `RM_LST` is:

```
1. (RM_LST left sub-tree traversal)
2. (Root's right sub-tree traversal) Root
3. RM_LST (RM_LST's Parent) (RM_LST's Grandparent) ... (Root's Left Child)
```

Clearly, we need visit the `RM_LST (RM_LST's Parent) ... (Root's Left Child)` chain
right after `RM_LST`'s left sub-tree is done. Since `RM_LST` right-links the `Root`
in the transformed tree, that's exactly when we meet the `Root` for the second time.
(Note: the visit chain is in the reverse order of the actual link chain, so **more extra
space may be needed**, breaking the O(1) extra space promise)

It can be proved (for example, by induction) that the visit chain above is enough for
the procedure to visit all but those in the right link chain of the root (including the
root) in post-order fashion. Those excluded happen to be the last ones to visit. To deal
with this, the paper proposed to add a fake root that left-links to the real root:

```c
void post_order_traversal(Node *root) {
    Node *fake_root = new_node_with_children(root, NULL);

    Node *cur_root = fake_root;
    while (cur_root != NULL) {
        if (cur_root.left == NULL) {
            cur_root = cur_root.right;
        } else {
            // The left sub-tree is not empty!

            // Find RM_LST (that either has been modified and has not been modified):
            Node *p = cur_root.left;
            while (p.r != NULL || p.r != cur_root) p = p.r;

            if (p.r == NULL) {
                // Get a RM_LST that has not been modified, we do the transform:
                p.r = cur_root;
                cur_root = cur_root.left;
            } else {
                // Get a RM_LST that has been modified, so we just find that `cur_root`
                // is a `Root`, we do the repairing:
                p.r = NULL;

                visit_rightlink_chain_in_reverse(cur_root.left);

                // We ignore the sub-tree of `cur_root` since it's a `Root`, turns to
                // its right sub-tree:
                cur_root = cur_root.right;
            }
        }
    }
}
```
