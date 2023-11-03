+++
title="On Detailed TCP Specification"
description="The what and why of some of the TCP's detailed designs."
date=2023-03-18
updated=2023-03-20

[taxonomies]
tags = ["web-spec"]
categories = ["network"]
+++

## State Machine

A TCP connection is defined between two **TCP endpoints** and a TCP endpoint is defined through a
tuple `(IPAddress, PortNumber)`. For a TCP end point, it manages its state using a state
machine ([RFC 9293, Section 3.3.2.](https://www.rfc-editor.org/rfc/rfc9293.html#name-initial-sequence-number-sel)).

## Sequence Number

In a TCP connection, SYN, FIN, and every data byte consumes exactly one sequence number so that they
can all be reliably acknowledged. 

We will call these 'effective unit' for simplicity.

## (Sending and Receiving) Initial Sequence Number

### Major concern

To make sure that a segment from previous incarnations of the same connection won't
confuse the current one, *one way* is to make the initial sequence number of the current
connection larger than the last sequence number used in the previous incarnation:

```
Second-to-last Incarnation:
A initiates conn to B
SN of A's segments:  0 -> 100(+2, 101)
SN of B's segments:  0 ->  10(+4,  13)

Last Incarnation:
A initiates conn to B
SN of A's segments: 222 -> 255(+1, 255)
SN of B's segments:  12 -> 112(+5, 116)

(assuming that any of the segments from
the last incarnation are still possible
to be alive and can arrive at A or B at
any time)

Current Incarnation:
1. A initiates conn to B:
SN of A's segments: ? (>255) -> ...
SN of B's segments: ? (>112) -> ...
2. B initiates conn to A:
SN of B's segments: ? (>112) -> ...
SN of A's segments: ? (>255) -> ...
```

But this approach requires remembering the last sequence number used in the previous
incarnation for every connection, can we do better and have a one-for-all global
value? 

Now, for an individual connection, sequence number is advanced for every byte sent and some
consumes sequence numbers faster, some slower, let's say Conn A consume 0-127 within 5s, while
Conn B consumes just 0-10 (due to, e.g. retransmitting), if the one-for-all value advances
as slow as Conn B, then if Conn A has a second incarnation after the 5s, Conn A 2nd Incarnation
would get an initial seq num of, say, 11, and if we assume that a segment from the previous
Conn A happens to have seq num 13 and is somehow still in the network, it might cause confusion
to the second incarnation of Conn A. On the other hand, if we choose to advance the one-for-all
value as fast as A, there will be no such concern. In short, we need to advance the one-for-all
sequence number as fast as a connection can consume seq nums, so, let's say experiments show
that a connection can consume as many as 10,000 seq nums in a sec, then we should advance the
one-for-all value by one every 0.1ms or less.

But as an integer value cannot be infinitely large, the global value will eventually wrap
around and previous values will come back, to mitigate this, one approach is to make sure
the minimum 'rebirth' time is large enough so that whenever a value is 'reborn' and reused,
the segment of the previous incarnation using this value should be long gone. Since the 
one-for-all value increases itself at a regular interval, we can simply make sure that it
can get large enough.

### ISN Exchange

The reliable exchange of initial sequence numbers of both sides is one of the motivations for the
three-way handshake: 

```
1. A  ---My ISN is X---> B (Syn)
2. A  <--Ok, I Got it--- B (Ack,)
         It is X.
         (Next time I
         expect: X+1)
3. A  <--My ISN is Y---- B (Syn)
4. A  ---Ok, I Got it--> B (Ack)
         It is Y.
         (Next time I
         expect: Y+1)
```

One thing to notice is that there isn't a 'ISN' field, instead, the ISN is contained in the regular
sequence number field, what makes it ISN is the 'SYN' control flag; another is that 2. and 3. can be
combined into one message which results in the 'three'-way handshake.

In the previous data flow, A initiates the connection, and then B response, but what if A and B initiates
conn to each other almost simultaneously:

```
1. A  ---My ISN is X---> B (Syn from A)
.. A  <--My ISN is Y---- B (Syn from B)
2. A  ---Ok, I Got it--> B (SynAck from A)
         It is Y.
         (Next time I
         expect: Y+1)
         My ISN is X.
.. A  <--Ok, I Got it--- B (SynAck from B)
         It is X.
         (Next time I
         expect: X+1)
         My ISN is Y.
```

A similar situation can occur when there is a Sync of the previous incarnation from the other end happens to
arrive:

```
----------------------------------------------
1. A  -->My ISN is X.... B (Syn from A)
.. A  <--My ISN is Z---- B (Deprecated Syn from B)
2. A  -->Ok, I Got it... B (SynAck to the deprecated Sync from A)
         It is Z.
         (Next time I
         expect: Z+1)
         My ISN is X.
1. A  ---My ISN is X--> B (Syn from A)
3. A  ...Ok, I Got it<-- B (SynAck from B)
         It is X.
         (Next time I
         expect: X+1)
         My ISN is Y
2. A  ---Ok, I Got it--> B (Ack to the deprecated Sync from A)
         It is Z.          (B: What? It is Wrong!)
         (Next time I
         expect: Z+1)
         My ISN is X.
4. A  ...(Using Z+1)<-- B (Reset from B) (Using Z+1 as the seqnum to prove this reset is really
          Z is Wrong!                     from someone who received the segment)
          Pls Reset!                     (B: stays in SYN-RECEIVED)
3. A  <--Ok, I Got it--- B (SynAck from B)
         It is X.          (What A will do?
         (Next time I       Discard it since
         expect: X+1)       seqnum is wrong?)
         My ISN is Y
4. A  <--(Using Z+1)--- B (Reset from B)
          Z is Wrong!
          Pls Reset!
5. A CLOSED, B stays in SYN-RECEIVED
----------------------------------------------
Now the client of A will probably retry with a
different ISN X' while B might retransmit the
SYNACK until it gives up. 
Right now we assume that A's retry msg will be
ignored when B's still in SYN-RECEIVED, then
eventually A will receive B's retransmitted msg,
to which A will respond with RST, then B is 
reset to LISTEN so that new connection can be
accepted and A's retry will succeed:
----------------------------------------------
6. A  ---My ISN is X'---> B (Syn from A)
7. A  <--Ok, I Got it--- B (SynAck from B)
         It is X'.
         Next time I
         expect: X'+1)
         My ISN is Y
8. A  ---Ok, I Got it--> B (Ack from A)
         It is Y.
         (Next time I
         expect: Y+1)
----------------------------------------------
```

### More

For more guards against confusion caused by segments from previous incarnation, check out:
1. [RFC 9293 (TCP), Section 3.4.1 (Initial Sequence Number Selection)](https://www.rfc-editor.org/rfc/rfc9293.html#name-initial-sequence-number-sel)
2. [RFC 7323 Section 5.8 (Duplicates from Earlier Incarnations of Connection)](https://www.rfc-editor.org/rfc/rfc7323.html#section-5.8)

For a recommended way to generate initial sequence number incorporating safety concerns, check out
[RFC 6528(Defending against Sequence Number Attacks)](https://www.rfc-editor.org/rfc/rfc6528.html#section-3)

## Reset

A client can reset its end point of a TCP connection, resulting in the end point going to
TIME-WAIT state.

A TCP end point can also send reset to the other end to inform it that something definitely
went wrong and it should reset itself instead of going on. Specifically, a TCP end point sends
a reset msg to the other end when:

1. The end point is in CLOSED state but a non-reset segment is received. (Including reset
   segment might result in infinite reset exchange)
2. The end point is in ready but non-synchronized states (LISTEN, SYN-SENT, SYN-RECEIVED),
   a segment whose Ack makes no sense to the end point or whose IP security setting is off
   the track is received. (I haven't established a connection, whoever you are talking to 
   should be gone now, better reset so you can talk to me normally)
3. The end point is in synchronized states and received a segment whose IP security settings
   are off the track. In this case, after the end point sends the reset msg, itself goes back
   to CLOSED state.

In cases 1. and 2., the connection is not yet established, the end point wants to bring the
other end to this same state, so that the next connection can be normally established. The
reset is OK since the connection is not established anyway.
In case 3., differences in IP security settings is a red alert, the connection should be fully
reset to ensure nothing is wrong.

When the end point is in synchronized states and receives a segment whose Ack makes no sense
or whose sequence number is outside of the window, it might have gone too far to reset the
current connection for possibly just an old segment. Maybe just ignore it? Ignoring it is fine
when the both ends are indeed working correctly and the segment is just an old segment. But
what if the other end just comes back after a sudden system reboot, with all of its states lost,
wants to reconnect? In this case, it seems like that this end really needs to be reset so a new
connection can be established, but it still has no idea whether the segment is a new SYN or just
an old one, whether it should reset itself or just ignore it. But the other end knows, why not
have the other end decide whether this end should reset or not? This leads to an idea of having
this end send a duplicate ACK, e.g. an ACK re-acks the last acked effective unit, when the other
side is indeed initiating a new SYN, the ACK acking a different effective unit will make it send
reset, when the segment is just an old segment and the other end is working correctly, the ACK
will probably be ignored since it acked what has already been acked.

And a TCP end point receiving a reset msg from the other end should first confirm it's really
from the other end by checking the sequence number to prevent attackers making up reset msgs,
then if:

1. It is in LISTEN state, it is already 'reset', thus do nothing.
2. It is in SYN-RECEIVE state and was in LISTEN state (was a listener), it goes back to LISTEN
   state, if it wasn't in LISTEN state (then it is a co-sender, gone to SYN-RECEIVE from CLOSED
   via SYN-SENT), it goes back (all the way) to CLOSED state.
3. Otherwise, it just goes back to CLOSED state.

## Closing

Since TCP is a duplex protocol, both ends of a connection can be closed to indicate that that end
will no longer send any data besides those before CLOSE is issued, although it can still ack msgs
from the other end to ensure reliability.
So a full termination of a TCP connection requires both sides initiating CLOSE and waiting to be
acked by the other side. 

After the last ACK is sent to ack the other side's FIN, a TCP end should wait for at least twice the
MSL for
1. All segments of this incarnation of connection to die out
2. The ACK to be reliably transmitted to the other end

But why is it 2 * MSL though?

It is all for the fact that the other end can have a retransmission timeout of at most 2MSL, when the FIN
arrived at this end extremely early (like, in no time), but the ACK is lost, 2MSL is absolutely needed
for the retransmitted FIN to arrive at this end though 1 MSL is enough for the last segment (the ACK) of
this incarnation to die out; when the FIN arrived at this end extremely late (after one MSL), 2MSL is
absolutely needed for the last segment (the ACK) this incarnation to die out though 1 MSL is enough for a
retransmitted FIN to arrive at this end.

## Segmentation

For a TCP end point, the unit of communicated messages is called 'segment'. 

Too large a segment can lead to too many fragmentations in the underlying network or, even worse, the 
receiver's inability to reassemble these fragments into the original host-to-host (IP) packet due to
insufficient reassemble buffer size, too small a segment can lead to too much communication overhead
per byte of data and inefficient usage of network bandwidth.

To constrain the maximum segment size, we need the MTU of the underlying network and the reassemble
buffer size of the receiver, so we can get the maximum segment *data* size through:

```
min(MTU, RRBS) - IPHeaderSize - IPOptionSize - TCPHeaderSize - TCPOptionSize

+---------+
|IP Header| 20 Bytes
+---------+
|IP Option| X Byte(s)
+---------+
|TCPHeader| 20 Bytes
+---------+
|TCPOption| Y Byte(s)
+---------+
| TCPData | Z Byte(s)
+---------+
```

The MTU might be a assumed fixed value or discovered through path traversal, the Receiver Reassemble Buffer
Size apparently needs to be heard from the other end, the Maximum Segment Size option is exactly for this
job, if a TCP end point wants the other end to know its RRBS, it should set this option and store the corresponding
value (it isn't RRBS though, it's RRBS - IPHeaderSize - TCPHeaderSize), though a default value is assumed
even if it doesn't set this option.

Naively, a TCP end point can use the maximum segment data size defined above to determine when to bundle the
user injected data into a segment and send to the other end although this approach provides little prevention
to very small segments since a user can report any value for the Maximum Segment Size.

However, if flow control and congestion control mechanisms are introduced, when a maximum segment data size
worth of data is ready, the flow/congestion control mechanism might suggest that it's not a good idea to send
the whole segment as this will overflow the receiver's buffer/congest the network. The new questions, then, are
whether we should chop the segment into smaller pieces so we can send something away right now or just wait
until the situation gets better and if we wait, how long should we wait before resorting to other solutions?

(Side note: When writing this section, I realized that I misunderstood the PUSH function/PSH flag and erroneously
believed that they can be used to make a piece of data be packaged into a single segment and sent to the other
end right away, this is wrong, the only functionality of the PSH flag in a segment is to let the receiver to push
the data inside the receiving buffer to the upper layer application when the receiver received the segment even if
the buffer is not full)

## Flow Control and Congestion Control

Flow and congestion control are intended to prevent a sender from overflowing the receiver's buffer space or congesting
the underlying network, respectively.

### Flow Control

If we don't want the sender to overflow the receiver's buffer space, one obvious way is to have the receiver
advertise its remaining buffer space to the sender, ideally, this msg should be sent at the beginning of a
connection and every time the receiver buffer space changes, i.e., increases (when a new segment is received
or consecutive segments all arrived) or decreases (when the upper layer application consumes data). The first
thing is notice is that the reason for fist type of change is precisely what makes an end point send ACKs, if
we have to send both an ACK and a buffer space msg at the same time, why not piggybacking the buffer space msg
in the ACK? 

But this only cover the first type of change, what about the second? Well, since the application can consume
data while the underlying TCP endpoint is receiving msgs, the second type of change can still be revealed in
a Ack, only when the sender stops sending -- so the receiver has nothing to Ack, the second type of change will
then not be known, if this is the sender's intent (i.e. the sender decides to close the its end) then it's fine,
no data is going to be sent and flow control isn't needed anyway. But if it isn't the sender intent -- the sender
wants to send more data but has to stop because e.g. the flow/congestion control says so, then what the sender
should do? 

Chopping the data into smaller pieces so it can at least send *something*? What if the other side says there's
**no** space in its receiving buffer in its last Ack? In this case, the sender cannot send anything so it cannot
receive any Acks, and thus lose the only way to know any changes to the receiver's receiving buffer. The solution
to this problem, though, is straightforward: send a one-byte data regularly in hope of an Ack, one-byte because
we don't want to fill the buffer again when it finally has pushed some data out.

But there's a bigger problem if we always decide to chop: we chop a small piece of data from the current segment
to form a much smaller segment that can fit right in the very little buffer space the other end advertises last
time, and the other end latter acks the small segment, but that's really all what happened, the buffer space in
the Ack is just how long the small segment is, then we have to do the chopping again. If this situation goes on,
we will be sending only very small segments!

The solution to this bigger problem is still simple: if there're no un-acked segment(s) whose acking will possibly
gives a bigger receiver buffer space, we really cannot do anything but chop and send, but if there is, we wait for
these possible acks.

### Congestion Control

Ideally, we should transmit data in the maximum rate that doesn't cause network congestion so that we can make
full use of the bandwidth without making other people unhappy.

But the network is changing all the time, the 'right point' is also changing, how can we reach it and mostly
importantly, keep adjusting ourself to the 'right point'?

The easiest way is just try a value and then see what's coming, if it's lower than the 'right point', we increase
it, if it's higher, we decrease it.

But what should our first guess be? In our case, it probably should be very low: we don't want to risk congesting
the network and annoy other people right after we show up, in the meantime, we want make full use of the network
bandwidth as soon as possible, so if our first guess is not causing congestion, we should aggressively increase
our next guess (e.g. 2 * previous guess). In summary, we should start low but stay aggressive.

Eventually, our aggressive guess would cause network congestion (indicated by, e.g. a lost segment), right now the
only thing we know is that our current guess is higher than the 'right point', to be absolutely sure that we won't
cause any further segment loss, we probably should go back to the initial safe-for-almost-all-cases guess and resume
the aggressive guessing but this time, we had some idea where the danger zone lies and should be careful not be reenter
it, conceptually, we should stop the aggressive guessing somewhere below the 'right point', and try to reach it slowly.
But we only know that the guess is higher than the 'right point', how can we come up within threshold that is below
the 'right point'? Though we need to know the 'right point' to give an precise answer, a good guess can get us started.
One possible guess for a value below the 'right point' is 'the congestion-inducing guess / 2'. It could be a good guess
if we assume the 'right point' is around the congestion-inducing guess. So, the plan is, we choose a threshold value that
we believe is below the 'right point', start with the initial guess and stay aggressive below the threshold but moves slowly
and carefully after the threshold. Of course, sometime later, we might again congest the network, since the above
discussion still applies in this case, we simply follow the plan again.

The TCP congestion control mechanism is much like what we have discussed above. It has a Slow Start state
corresponding to our aggressive guessing that, in principle, doubles the transmission latency RTT and a
Congestion Avoidance state corresponding to our slow/careful guessing that, in principle, let we transmit
one more segment every RTT.

Specifically, it uses the idea of CongestionWindow (`cwnd`) to limit the maximum amount of in-transit data to
effectively limit the transmission rate and the corresponding window size threshold SlowStartThreshold (`ssthresh`)
to determine its state.

It sets a initial `cwnd` (usually equals to n * MSS) and `ssthresh` (usually equals to the maximum to impose no limit
to the Slow Start state) and goes to Slow Start state in the beginning of a connection, in which it doubles `cwnd`
when a full `cwnd` worth of segments are acked by the other end (i.e., every RTT, conceptually), when the network congestion
is indicated by a **new** lost segment, the `cwnd` is reduced to its initial value and `ssthresh` is reduced to 
`max(InTransitDataSize / 2, MinimumInitialCongestionWindow)` and Slow Start starts again, but whenever `cwnd > ssthresh`,
it transits to Congestion Avoidance state, in which it effectively increases `cwnd` by one MSS whenever a full `cwnd`
worth of segments are acked by the other end (i.e., again, every RTT, conceptually).

Other than those discussed above, TCP connection control mechanism also includes a optimization aiming to detect network
congestion faster, Fast Retransmit along with Fast Recovery, the main idea is to have the receiver send the last Ack when
a segment arrives out-of-order indicating to the sender that (a) segment(s) between the last acked segment and the just
received might have been lost, when the sender received 3 such identical Acks (before a timeout triggers), the sender
takes this as a good sign of network congestion, so it adjusts `ssthresh` as just described but instead of dropping `cwnd`
all the way to the initial value and transits to Slow Start state, it effectively goes past Slow Start state and sets
`cwnd` to `ssthresh + 3 * MSS`, the `3 * MSS` part is due to the fact that the three duplicate Ack also indicates three
segments are arrived at the receiver.

For detailed description, check out [RFC 5681: TCP Congestion Control](https://www.rfc-editor.org/rfc/rfc5681.html#section-3).

### Combining Flow and Congestion Control

Flow control and congestion control should really be combined to achieve both goals. 

The sending window size, indicating how many bytes of in-flight data can a sender injects to the network, should be
the smaller of the last receiver-advertised buffer space and the current CongestionWindow.
