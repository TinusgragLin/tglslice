+++
title="QuickNote - Raft - Basic Design and Implementation"
description="Things to be written down to be sure of what I don't understand, how I can approach its implementation."
date=2023-03-24
updated=2023-04-17

[taxonomies]
tags = ["raft"]
categories = ["quicknote"]

[extra]
ToC=true
+++

## Random Points I am Unclear of

Here's some random points I'm not clear of after I've read major parts of the [Raft paper](https://raft.github.io/raft.pdf)
and my attempts to answer:

1. Are AppendEntries RPCs sent **periodically only**, so you have to wait for
   a timer to go off before you can send **any** AppendEntries RPC? If it isn't,
   i.e., you can demand an AppendEntries to be sent right away, is the heartbeat
   still going on?

   This doesn't seems to be explicitly discussed. There are three ways to handle the two
   type of AppendEntries RPCs I can think of:  

   1. Make them parallel with respect to each other.
   2. The RPC is only sent periodically, not on demand, so you have to wait for
      the next communication point if you want to send 'real' msgs.
   3. Stop the heartbeat ones when there are on-demand ones need to be sent, heartbeat
      ones are for screaming out "I'am alive" after all, if we have something real
      to send, trying to sending these real msgs is definitely a proof of liveness.

   Overall, I think Option 3 is the most plausible one, Option 1 wastes network bandwidth,
   Option 2 will delay client's request handling, although probably not by a lot.

2. After the leader commits and applies the log, is it going to tell the other
   servers to apply to log? If so, how?

   The leader includes the index of the last committed log entry, when other
   followers learn that this log entry is committed, they will apply the log
   entry.

3. When does the leader reply to the client? Is it after the log commit? Or
   after applying the log entry? Or after it tells other servers to apply the
   log entry?

   After applying the log entry.

4. Depending on its state, a raft server may have a lot of things to do, e.g.
   receiving client requests, applying log entries, sending AppendEntries as the
   leader, or receiving client requests, having re-election timer going, handling 
   the leader's AppendEntries as a follower. Should all of these be run in parallel?
   If not, which part should be run in parallel?

   So, as it turns out, there are two major ways of implementing raft, one way, populated
   by etcd, is to model a raft node as a discrete-time state machine, the progress is made
   by advancing the state machine with/without inputs tick by tick. 

   Another way is the normal multi-thread and/or multi-coroutine approach. Different threads/
   coroutines are communicated by channels, thus `select` -- the operation of handling the 
   earliest `recv` event of a channel when concurrently waiting for multiple channels, is
   typically used.

## Handling Client Requests

### Candidate

Deny or reply "I don't know yet".

### Follower

If `cur_leader_id` is none, deny or reply "I don't know yet", otherwise reply with "contact the leader at ..."

(r:`cur_leader_id`, `cluster_config.member_addresses`)

### Leader

- Append a new log entry with the command in the request.

  (w:`log`)

- Wait for the replicating tasks to finish the replicating of the log entry.

  (might r:`log_committed_up_to`)

- Wait for the state machine executing task to complete applying the log entry
  and get the result.

  (might r:`log_applied_up_to`)

- Reply with the command executing result.

## Handling Internal Rpcs

In all cases, if a rpc with a **higher term number** is received, the receiver should update the term and revert
back to the follower state (if not already) first before further handling.

(w:`cur_term`)
(
leadership state change: `Candidate` -> `Follower`, w:`leadership_state` or
leadership state change: `Leader` -> `Follower`, w:`leadership_state`,
`next_log_append_idx`s (init),`log_replicated_up_to`s (init),`cur_leader_id` (invalidate)
)

### AppendEntries

#### Operations

In all cases, deny if the message's term number is less than the current term.

(r:`cur_term`)

Thus, the following deals only the case where the message's term number is the same as the
receiver.

- Leader

  Since `AppendEntries` rpcs are only sent by a leader, and raft guaranteed that there will only be one leader
  for one term, a `AppendEntries` with the same term number indicates a critical system error.

- Candidate

  Revert back to the follower state first before further handling the rpc.

  (leadership state change: `Candidate` -> `Follower`, w:`leadership_state`)

- Follower
 
  *Reset re-election timeout.*

  (r:`cluster_config.election_timeout_range`)

  - Do the consistency check first, and deny if the consistency check fails.

    In consistency check, we check if the meta info contained in the msg about the log
    entry new log entries should insert after can lead us to an existing entry in our log.

    (r:`log`)

  If the age check is passed, then the msg either:

  1. contains no entry, in which case the rpc is just a heartbeat.

  2. contains some entries, and the range of these entries may overlap with
     existing entries in the current log.

     First, for the overlapping part, we examine each pair from start to end, if

     1. the two entries on both sides matches (in, specifically, `term`), then
        we skip it.
     2. otherwise, we trust the msg and discard all the entries starting at this
        examined one. Note that we just expanded the non-overlapping part in this
        case.

     (r: `log`, w: `log`)

     Then, for the non-overlapping part, we append all those entries to our log.

     (w: `log`)
   
  Then, the server updates its `log_committed_up_to` if necessary.

  (w: `log_committed_up_to`)

  Finally, the server return the response.

#### States Access Summary

R: `cur_term`, `cluster_config.election_timeout_range`, `log`

W: `cur_term`, `leadership_state`, `next_log_append_idx`s, `log_replicated_up_to`s,
   `cur_leader_id`, `log_committed_up_to`, `log`

or:

Exclusive:

`cur_term`
`log`

`leadership_state`
`log_committed_up_to`
`next_log_append_idx`s
`log_replicated_up_to`s
`cur_leader_id`

Read-only:

`cluster_config.election_timeout_range`

### RequestVote

#### Operations

In all cases, deny if the message's term number is less than the current term or the server
has been voted to any **other** server.

(r:`cur_term`, `last_voted_to`)

Thus, the following deals only the case where the message's term number is the same as the
receiver and the server has not voted to any **other** server.

In all cases, 

Do the age check, deny if the age check is not passed, write `last_voted_to` and return sucess
if passed.

In consistency check, we check if the meta info contained in the msg about the last log
entry of the sender at the moment of sending this msg indicates that the sender's log is
not older than ours.

(r:`log`(length and `term` of the last entry), w:`last_voted_to`)

#### States Access Summary

R: `cur_term`, `log`, `last_voted_to`

W: `cur_term`, `leadership_state`, `next_log_append_idx`s, `log_replicated_up_to`s, `last_voted_to`

or:

Exclusive:

`last_voted_to`
`cur_term`
`leadership_state`
`next_log_append_idx`s
`log_replicated_up_to`s

Read-only:

`log`

## Background Tasks

### The Background Tasks Managing Task (The Manager, or, `ALPHA`)



### The State Machine Executing Task

This task should be running the inner state machine and provide ways to apply committed log entries
to or read states from the underlying state machine.

(o:`state_machine`)

### Vote Requesting Tasks (Candidate Specific)

Dedicated vote requesting tasks, one for each of all the other servers.

#### Operations

Specifically, a vote requesting task for a targeting server should:

- Send a `RequestVote` RPC request.

  (r:`id`, `cur_term`, `log`^ (the **last log entry** meta info))

- Wait for the reply.

- Discard the reply if its `term` is less than `cur_term` and retry the request,
  report back to `ALPHA` and terminate if higher (in this case the server should
  reverts back to `follower` state).

  Otherwise, report back the result of vote request to `ALPHA` and end.

  (r:`cur_term`)

### Log Replicating Tasks (Leader Specific)

Dedicated log replicating (& heartbeat) threads, one for each of all the followers.

#### Design Concerns

- Replicating trigger:

  `log_committed_up_to` (global) > `next_log_append_idx` (local)

  1. Local `next_log_append_idx` collected to `ALPHA`

     `ALPHA` is responsible for
       1. collecting global `log_committed_up_to`
       2. notifying some of the log replicating tasks (with `log_committed_up_to`)
     
     The local log replicating task only needs to
       1. listen to notifications from `ALPHA` 

  2. Global `log_committed_up_to` collected to local

     `ALPHA` can collect `log_committed_up_to` first and forward it to
     every tasks.

     In this case, `ALPHA` is responsible for
       1. collecting global `log_committed_up_to`
       2. directly forwarding this info to every tasks
     
     The local log replicating task needs to
       1. collect `log_committed_up_to` from `ALPHA`
       2. examine `log_committed_up_to` and `next_log_append_idx`

     Or whenever `log_committed_up_to` is changed, its value is sent to every tasks,
     this requires either:
       1. all tasks listen to one single channel, or
       2. channels to all tasks are known whenever `log_committed_up_to` changes

- `log_committed_up_to` Update

  1. Updates of `log_replicated_up_to` are reported back to `ALPHA`, who
     counts and gives the update to `log_committed_up_to` whenever suitable.

#### Operations

Specifically, a log replicating task for a targeting server should:

(r:`log_committed_up_to`?)

(o:`next_log_append_idx`(one), `log_replicated_up_to`(one))

- Setup a background timer that ticks whenever a whole `heartbeat_timeout` worth of time has passed.

  (r:`cluster_config.heartbeat_timeout`)

- Wait for

  - The reply to the last replicating RPC has arrived

    If the reply contains a higher `term`, report back to `ALPHA` and terminate.

    Update `next_log_append_idx`, `log_replicated_up_to`, report back to `ALPHA`.

    (r:`cur_term`)

  - The reply to the last Heartbeat has arrived

    If the reply contains a higher `term`, report back to `ALPHA` and terminate.

    Report back to `ALPHA` that a successful heartbeat communication is just done.

    (r:`cur_term`)

  - Replicating RPC send signal

    Delay handling if the last replicating RPC has not yet received its reply.
    (Or just cancel the last one and send a new one?)
     
    Send `AppendEntries` with log entries data starting at `next_log_append_idx`.
    If successful, reset the heartbeat timer.

    (r:`id`, `cur_term`, `log`)

  - Heartbeat send signal

    Cancel the last Heartbeat if its reply is still misssing now.

    Send an empty `AppendEntries` that says: insert no log entry after `next_log_append_idx`.

    (r:`id`, `cur_term`, `log`(for meta data of the log entry just before `next_log_append_idx`))


(Within a `cluster_config.election_timeout`, a leader should receive replies to its RPCs from a
majority of all servers, if not, the leader should revert itself back to follower state)
