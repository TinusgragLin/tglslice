+++
title="MQ and PubSub"
description="How are they different?"
date=2023-03-14

[taxonomies]
tags = ["pub-sub", "mq"]
categories = ["thoughts-on-topic"]
+++

We focus on two massage passing paradigms: Message Queue and Pub-Sub.

The way I understand it, the major part of a message queue is just, literally, a queue
of message, the control logic may pessimistically wait for message consumers or actively
forwards it, either way, to make sure a message is not lost forever, it needs acknowledgements
from consumers.

For pub-sub, it is just like how the mail newspaper works: you order newspaper of your
choice and have your mailbox setup, and newspaper press produce the content of a piece
of newspaper and have somebody copy it and deliver one to everyone subscribes it.

For example, say the 'somebody' just receives a new issue of Today's Waterfall from
Waterfall Local Press and finds that only Alice and Bob wants to read Today's Waterfall,
so he/she make a copy and send it first to Alice and send the original copy to Bob,
later he/she receives a new issue of The Guardian from the City Press and finds Alice,
Mike and Tom wants it, he/she again make two copy of newly received The Guardian and send
it to Alice and Mike and send the original to Tom.

Now assume these people are all on vacations and not home, the 'somebody' has to pile
newspapers inside/in front of their mailboxes/front doors.

Inside Alice's mailbox lies first Today's Waterfall, and then the Guardian, following the
order the 'somebody' receive them.

![pub-sub-of-newspaper](./pubsub.svg)
