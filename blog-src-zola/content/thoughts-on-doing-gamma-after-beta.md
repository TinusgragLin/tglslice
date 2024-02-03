+++
title="On 'Do `γ` After an Outside Event `β`'"
description="TLDR: whoever (not the source) does it do the checking."
date=2024-02-03
updated=2024-02-03

[taxonomies]
tags = ["event-handling", "multi-tasking"]
categories = ["dive-into-that-lake"]

[extra]
ToC=true
+++

# Thoughts on 'Do `γ` After an Outside Event `β`'

## From

Suppose there are only two persons (`A` and `B`) in the world, and they can not
communicate. B can produce event `β`, which `A` can always observe. Now, `A`
thinks that after `β` happens, `γ` should happen. For `A`, There's only one
reliable way to make sure `γ` happens after `β`:

- `A` needs to actively watching (or checking, polling) for the occurrence of
  `β`, and also do `γ` themself.

Now suppose further that `A` and `B` can communicate, now `A` has two choices:

- `A` still does `γ` themself.

  Then `A` still needs to be aware of the occurrence of `β`, and needs to either
  1) actively check for the occurrence of `β`, or 2) tell `B` to send a message
  when `β` has happened, and then actively checking for the occurrence of the
  message.

  So either way, `A` still needs to do some active checking.

- Let `B` do `γ`

  In this case, after `A` tells `B` their intent, `B` does `γ` after doing `β`.

Now further suppose that there is the third person `C` in the world.

- A still does `γ` themself.

  `A` again needs to do some active checking.

- Let `B` do `γ`.

  The best approach is still directly reach out to `B`.

- Let `C` do `γ`.

  `C` is in the same situation as `A` before: wants `γ` happen after `β`, an
  event not produced by themself.

---

One rule one might has observed so far is that whoever that is not the source of
event `β` but is responsible for actually carrying out `γ` after `β` has to be
actively checking for either the occurrence of `β` itself, or an event that
indicates the occurrence of `β`.

Based on this observation, we may conclude: if `A` wants `γ` to happen after
`β`, an event produced by `B`, then:

1. Either the source of `β` (`B`) has to be informed to do `γ` after `β`.
2. Or whoever that is not `B` but is responsible for doing `γ` has to actively
   checking either the occurrence of `β` itself or an event indicating it.

   And the event indicating the occurrence of `β` could be what another person
   `X` would do after the occurrence of `β`. So, yes, we could have a recursion
   chain here, and at the end of this chain, it is either:
   1. somebody that is not the source of an event actively checking for the
      occurrence of that event so they can do something, or,
   2. the source of an event is informed to do something after that event.

---

Now we focus on the 'actively checking' part above. Actively checking for just
one thing seems like a waste of time if one has something else to do / to check.
Luckily in real life a human being always checks for multiple things just about
every moment: sound, light, plans, thoughts, etc. and acts accordingly based
on the results of all these checks in a schedule. That's why one can be handling
multiple tasks at the same time. This multi-tasking ability is also implemented
in a similar way in most computer OSes, or as we shall see, most user-land
multi-tasking managing system.

## To

Now we dive into the computer world. One important fact in that world is that it
is the *hardware* that actually does all the works.

Specifically, it's sometimes beneficial to realize that the processors are the
real executors:

- OSes and user programs are simply instructions that tell the processors what
  to do.
- 'Processes' and 'threads' are all abstractions created by the *OS* to manage
  the execution states of programs:

  - A process is a structure representing the state of a loaded program.
  - A thread is a structure representing the state of an execution of a sequence
    of instructions inside a loaded program.

  In early days, the execution of an entire loaded program is the unit of the
  OS's multi-task scheduling, so there is only one structure for execution state
  (i.e. thread) inside a process, which people may simply call '*the* execution
  state of this program'.

  However, this way only inter-program concurrency and parallelism is exploited.
  In order to support intra-program multi-tasking, the OS needs to keep multiple
  execution state structures for a process and find a name for the new unit
  of multi-task scheduling, so the concept of a 'thread' is used to refer to an
  execution of a sequence of code inside a program. A more concrete definition
  for 'threads of a process' can be 'the execution state structures the OS keeps
  for each process (loaded program)'.

  This, however, isn't enough for user programs targeting massive multi-tasking:
  relying on the OS for multi-task managing and scheduling can be costly and
  inflexible. Hence, the idea of a user-space multi-task manager/scheduler was
  explored.

  Since it is the OS who communicates with the hardware to make the parallelism
  enabled by multiple cores possible, and 'thread' is the OS's unit of
  multi-task scheduling, to enable parallelism for a user-space multi-task
  system, the system needs to schedule tasks to multiple threads. This is often
  referred to as the 'M:N' mapping, as in 'mapping M tasks into N threads'.

  Some of those massive multi-task systems, however, focus on receiving and
  handling a massive number of IOs rather than computation-heavy tasks, thus
  choose user-space multi-task systems that schedule tasks on a single thread to
  avoid having to worry about concurrency issues. This is often called 'M:1'
  mapping.

  Either way, this user-space multi-task manager needs an IO mechanism (provided
  by the OS) that doesn't result in the OS stopping the execution of a thread
  where an IO request was just recognized and processed until that IO request is
  done, since 1) otherwise a task requesting IOs running on a thread would put
  the thread into a paused state until the requested IO is done, the user-space
  multi-task manager wouldn't be able to schedule other tasks to run during this
  paused period, and 2) a user space program can not directly talk to the IO
  devices and has to rely on the OS for that.

With all the previous content presented, let's talk about, from bottom to top,
how a program is able to do `γ` after `β` where `β` is an IO event.

An IO device usually indicates an IO state change as a output pin, the output
pin is often connected one of the *interrupt request* pins of an *interrupt
controller* (e.g. Intel 8259), which is in turn connected to the CPU(s) (for
multi-core systems, the OS can cooperate with the interrupt controller(s) to
deliver interrupts in a specific way), the CPU(s), synchronized with the system
clock, performs a *check* to the interrupt input pin and read from the data bus
the interrupt request number the interrupt controller gives, and looks up a
table for an address corresponding to the start of an interrupt handling
procedure for the interrupt request number.

(NOTE: this is apparently a vastly simplified version, there are details about
interrupt priorities, acknowledgements, disabling interrupt during interrupt
handling and more)

The OS, fills the interrupt request number to handler address table with
addresses of procedures it has defined, so when certain interrupt comes, it is
able to adjust its state accordingly. For example, when a thread is marked
'should-not-be-scheduled' for waiting for an IO request, it can be marked
'can-be-scheduled' again by the OS after an interrupt indicates the completion
of the IO request.

The user program can then make use of one of the IO notification / completion
handling infrastructures provided by the OS to do `γ` after `β`.

As can be seen above, the root is that each processor, at each clock cycle,
**actively checking** for an occurrence of some interrupt signal. Now combining
with the discussion from first section, there are two ways to think about this:

1. Since a program is nothing more than instructions for the processor, it can
   be said that the processor itself wants to do `γ` after `β`, and thus choose
   to actively checking for the occurrence of `β`.

2. Or, each sequence of code organized for certain 'task', the internal logic of
   the processor (e.g. the way it reads and execute instructions and handle
   interrupts) or that of any other hardware can be thought of as a different
   person. So, for example, some part of the OS wants to do `γ` after `β` (some
   interrupt request), it knows that the processor logic will do `δ` (jumping to
   some address) after `β`, so now it wants to do `γ` after `δ`, it informs the
   processor logic about this intention by effectively altering the **exact**
   behavior of the processor logic in the way of changing a part of its memory.

   Now, for any 'task' except for the OS's scheduler, however, its 'liveness' or
   'being alive' or 'being able to experience the time' is controlled and
   scheduled by the OS scheduler, so if it wants to do `γ` after `β`, an event
   not produced by itself, the scheduler can pause the execution of this task
   when this intention is understood and resume it after `β` happens. As far as
   the 'task' is concerned, after the intention is sent, it simply time-leap to
   a future after `β` happened, and thus happily start to do `γ`. The original
   intention of do `γ` after `β` effectively gets translated to 'pause the
   execution until the OS is aware of some condition is true', *this*, however,
   is just **informing the OS to do something (resuming execution of a thread)
   after an event happens.**

   A good example for this other than IO request would be how `pthread_wait` is
   implemented: 1) `pthread_wait` would call a `futex` system call that pauses
   further execution of the current thread and also push it into the `join`ed
   thread's completion waiting queue, 2) any thread managed by `pthread` library
   calls `pthread_exit` when it exits if it does not call `exit` first, in which
   case the whole process terminates and 3) `pthread_exit` calls another `futex`
   system call that wakes up all threads in the completion waiting queue of the
   current thread. In this example, the calling thread's intention of running
   some code after the completion of the `join`ed thread is translated by the
   `pthread` lib to 'pause the execution until the OS is aware that the calling
   thread is removed from a `futex` waiting queue'.
