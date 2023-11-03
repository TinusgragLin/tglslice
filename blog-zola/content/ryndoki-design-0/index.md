+++
title="Proj Ryndoki - Thoughts - 0"
description="(WIP) Thoughts on designing a file sync tool."
date=2023-03-13
updated=2023-03-17

[taxonomies]
tags = ["ryndoki", "sync-tool"]
categories = ["thoughts-of-designing"]

[extra]
ToC=true
+++

# General Design Thoughts for Ryndoki, a Sync Tool

## Project Naming

Rust + Sync + dōki(同期)

## User data hierarchical organization:

### Workspaces

A workspace is per-user data storage, containing all the data a user works with. It is conceptually the root repo of a user.

### Data source  

An abstraction of a place user data can be retrieved and stored. It consists
of multiple repositories each contains a set of related files.
A data source should be able to:

- Reveal some of its meta data
- Give duplication information when the fingerprint of a updated version of
  an existing file is given
- Accept an update of an existing file
- Give updates to an file

### Repository  

An abstraction of a set of logically related, hierarchically structured data.

A repo can be created in, sync to and sync from an existing data source. (or data sources? Allowing replicated synchronization?)

To allow synchronized sharing and collaboration, a user's repo can contain references to other people's repo, or files/dirs from
other people's repo. An 'immutable' reference let you always have a latest copy of the data but you can not have your modifications
seen by other people while a 'mutable' reference, which you can acquire through a contributor or a collaborator membership of a
repo, allows your modifications to be seen.

- On the idea of a central place where a user can check out other people's repos and refs their contents:  
  - What a user is able to see  
    1. Information of a repo itself:  
       owner, contributor, collaborator, name, visibility level, modification time, revision history
    2. Content of a repo:  
       repo structure (refs included), each file's name, modification time, revision history
  - What a user is able to do:  
    1. Send contributor or collaborator membership request to a repo's owner
    2. Download to local (workspace not included), or clone, immutably or (if a membership of contributor or collaborator is
       obtained) mutably refs content into the user's repo

- On how we should represent refs:  
  1. Store all refs' info in a repo's meta data (preferred)
     When this piece of meta data is needed:  
     1. A client wants to check out other people's repos and their content.
     2. A client wants SyncTo/SyncFrom of a repo possibly containing refs and wants to know the refs' destinations.  
        (this task could delegate to aggregated data sources)

     Where this piece of meta data should be stored:
     1. Aggregated data sources  
        - Since the global data server also need this info, the global data server could hear from all aggregated data sources and cache
          the data, the initial cache could be updated by aggregated data source heart beat msg.
        - When a ref is added to a repo, it is considered as a change but instead of starting normal delta sync process,
          1. A msg is send to the data source to inform it this meta data change of the repo  
          2. The data source should ack this msg and also gives the info of the data source where the repo the ref refs to resides
             so that the client can retrieve some real data.  
          3. After the ack is received at the client's side, the client set up a listening channel for any change of the refed data.
        - When a ref in a repo is removed by the user,  
          1. A msg is sent to the data source to inform it the removal.
     2. Global meta data server
  2. Using a special file format to represent a ref in its place

### Files/Dirs (identified by a path within its residing repository)

## Safety concerns with authentications and authorizations control

### A Exposure Problem

Consideration 1: A data source should be just a port data can flow, it should not
expose the local or remote sources it drains data from/pushes data to.  
Consideration 2: A user can create a new repo which is stored in the local storage of
a data source, and he/she should be able to add refers to data in other repos stored in
some other remote sources to the repo. That is, A user should be able to check out 
repos in some remote sources.  

- A client should only be able to check out repos of remote sources from a central meta
  data server.

### Authentications

To authenticate a client, we have a few choices:  
1. TLS client cert request with some kind of client identification (e.g. Email address)
2. Account password based authentication with some kind of client identification (e.g. Email address)

I would choose 1 for the sake of implementation simplicity. In this case, a client need to generate
key pairs with his email address and has the CA sign a certificate it can later use to communicate
with various servers.

First, any server a client can connect to needs cert, this includes: aggregated server, global meta
data server, message servers, in all of these connections, the client needs also to be authenticated,
so we need two way TLS for all of these connections.  

Second, in the cases of a aggregated server connects to the message server or the global meta server as
well as a trivial data source, the server and the client both needs to be verified, so we again need two
way TLS.  

A client, a aggregated server, a trivial data sources can play the role of a 'client'.  
An aggregated server, a global meta server, a message server can play the role of a 'server'.  

In a one way TLS, the client need to trust the CA, and the server needs a cert signed by the CA.
In a two way TLS, the client and server both need to have a cert signed by the CA and also trust the CA
and have the CA's cert and pub key.  

ALL components in our system needs to talk to the CA server.

Or maybe the second category don't actually need two way, then:  
1. Only clients, aggregated servers, global meta data server, message servers needs cert signed by CA and
   also to trust CA.  
2. Trivial data sources only need cert.

Or maybe only the connection between a trivial data source and an aggregated data source don't need two way
auth, then the requirements list are the same as above. 

But with the set up of a CA server, we need to solve the problem of cert revocation. With OCSP stapling,
we can check the status of 'server role' cert. For 'client role' cert status check, it is not clear
whether it is supported in common implementations or not. We can manually implement similar thing, though,
i.e. have the client send a CA signed time-stamped OCSP response to the server.

Summary: 

1. Clients, aggregated servers, global meta data server, message servers needs cert signed by CA and
   also CA's public key and cert.  
2. Trivial data sources only need cert signed by CA.

### Client Authorizations (Access Controls)

#### Accesses to Repos  

To a client, a repo can be:  
1. Invisible
2. Visible but not modifiable
3. Visible and modifiable but changes to the repo need to be approved (Contributor)
4. Visible and modifiable, changes to the repo need not to be approved and you can approve other people'
   changes. (Owner and Collaborator)

Division of 1 and 2 is done by visible level, 2, 3 and 4 by the concept of contributors and collaborators.

#### Visible level  

1. A client has a privilege level.
2. A client is given the lowest upon registration.
3. A repo has a visibility level. 
4. A client is only allowed to create and see repos no higher than his/her privilege level. 
6. A client can request a higher privilege level from a central server, this request will be approved
   or denied by management team.  
   Repos owned by the client before this level ascension not are changed in any way.
7. The management team can lower a client's privilege level on the central server. Before they can
   do this, they should decide what to do with repos of this client that has a higher visibility level
   than the descended privilege level, for each of these repo, they can change the owner of it to
   someone whose privilege level is no lower than the repo's visibility level, in which case that
   person has to agree on this for the transition of ownership to be done, or they can simply discard it.  
8. The owner of a repo can increase or decrease the repo's visibility level as long as it's not above
   the owner's privilege level.  
   When a repo level ascension is done, less people should be able to see it, thus this msg should be
   immediately consumed by all concerned roles. 
   When a repo descension is done, more people should be able to see it, thus the msg can be delayed.

- Where this info should be stored  
  1. A client's privilege level  
     - When this info will be needed:  
       1. A client wants to create his/her repo
       2. A client wants to change his/her repo's level
       3. A client wants to check other people's repos
     - Possible candidates:
       1. global meta server
  2. The visibility level of a repo owned by a client
     - When this info will be needed:
       1. A client wants to check other people's repos
     - Possible candidates:
       1. global meta server

#### Contributor/Collaborator Membership  

1. A client can request contributor/collaborator membership of a repo from the owner of that repo. This request
   should be sent to the repo owner via message server. (the client should listen to, say, a 'notifications'
   channel) The owner of the repo, upon reception of this request, should approve or deny it. 

3. An aggregated data source, upon receiving a change push request to one of its repo data, should verify the
   originator of the change.

- When this info is needed  
  1. A data source wants to verify whether changes to a repo from a client are valid.
  2. A repo's owner want to check all contributors and collaborators.

- Where this info should be stored
  1. (Aggregated) Data sources

### Accesses to Data Sources  

To a client, an aggregated data source can be:

1. Visible but not appendable 
2. Visible and appendable

Division of 1 and 2 is done by appending permitted list.

Two forms:  

1. Appending permitted list for a data source  
   A data source initially has an appending permitted list of zero entry.  
2. Appending permitted list for a client (this is **preferred** currently)  
   A client initially has an appending permitted list of zero entry.

In general:

- When a client want appending permission for a data source, a request to the central server
  should be send and management team should approve or deny the request.  
  The data source could send the request of behalf of the client so that itself, as a concerned
  role in this process, directly get the right info. In this case, the client should turns to
  the data source for permission request.
- The management team can revoke the appending permission to a data source of a client. All of
  The clients' repos residing in the data source should not be removed until the client is fully
  informed, the client should be able to download all these repos before they are removed from
  the data source.   
  This revocation should be known to the data source.  
  To prevent the client to push his/her changes to its repos already at the data source or create
  a new repo after the management sends the msg to the data source but before the data source receives
  it, a data source is required to check the permission before any modification to its content can be
  made, revocation messages from the central server, however, can still be sent to timely inform the
  data source.  
  The cleaning process starts as soon as the central server or data source can talk to the client.  
  The revocation can also be sent the message server to notify the client.  

## Synchronization

### Versioning

To have unique versioning, we version each revision of a repo combining the client identify of the
last change and the last change's modifier-local modification numbering, for example, a revision
history of a repo might look like this:

```
(Owner: Mike)

Mike's 1st Modification
Mike's 2nd Modification
Mike's 3rd Modification
Mike's 4th Modification
Alice's 1st Modification
Alice's 2nd Modification
Mike's 5th Modification
Bob's 1st Modification
Alice's 3rd Modification
Bob's 2nd Modification
Bob's 3rd Modification
```

Because, for example, there won't be two "Mike's 2nd Modification" (in a single branch of history), we
can use a tuple `(ModifierID, ModifierLocalModificationID)` to uniquely identify a revision.

This versioning should be enabled even in cases where there isn't any sharing **yet**.

For the definition of one modification, we adopt the widely used Open-to-Close with modification check
mechanism i.e. a new version is given when a client close a file he/she earlier opened for modification
and modification time check indicates a modification are indeed made.

### General Synchronization Datapath

- Client changes sync to data source (SyncTo)  
  1. Non-ref content changes:   
     The client can directly forwards these changes to the data source.
  2. Ref content changes:  
     The client could ask the data source to give the address of related data sources and directly forwards
     changes to these data sources.
- Other clients' changes to the client's repo sync to local client (SyncFrom)  
  1. Non-ref content changes:  
     The client listen to a dedicated channel for all non-ref content changes.
  2. Ref content changes:  
     The client listen to a channel for each of the root ref content.

### Multi-clients Synchronization

In Ryndoki, multi-clients synchronization is supported through the concepts of contributors and collaborators.  

#### General Multi-clients Synchronization Process

When no file is opened, SyncFrom is always active. When a file is opened for read, SyncFrom is delayed until
the file is closed, and carried out normally. When a file is opened for write, we may:  
1. pause SyncFrom, issue a file lock to the data source, after the file lock is confirmed and the (locked) newest
   version of the file is known, and then either 
   1. the file is not allowed to be modified until SyncFrom is carried out and all necessary updates are performed
      to make the local version the newest, and after the file is closed, modifications are checked, and after the
      modification (if any) is confirmed by the data source, lock is released and SyncFrom is resumed OR  
   2. if hijacking fs calls is hard, prompt the client to close the file meanwhile download the newest version of
      the file directly from the data source and after the file is closed, modification time is checked and if no
      modification is carried out, cancel the downloading if it is still going on or simply replace the old file
      with the downloaded file if the download is completed, and then issue an unlock, resume SyncFrom, if, on the
      other hand, modifications are carried out, the downloading is made sure to be completed, the client's file
      is renamed, the downloaded file takes the original place and the two files are presented to the client. Note
      that the lock is still there at this moment, the client has to decide what the final version is going to be
      within a fixed amount of time, if the client responded with a final version, the final version is selected
      to be the next version and normal logic applies, if the client fails to respond with a final version within
      that amount of time, the client's version is moved to a special folder, lock's released and SyncFrom's resumed.

#### Contributors and Collaborators

The only difference between contributors and collaborators are really whether the confirmation of changes are
delayed until the changes are approved.  
Specifically, the 'file close' is done after the approval of changes for a contributor.

## Client Operations Overview

- A client first need to register its identify. An email address is needed and verified via email
  verification code, then

- As a client, you need to create a dedicated workspace directory, where all your repos and repo
  refs are contained.
- As a client, you either want to create your own repo, or check out and maybe work on repos
  created by others.  

  You can create a repo with a level of privilege no higher than yourself and have it stored in
  a data source if you have write/create permission of that data source, for that, you need to talk
  to the central server that manages the data source.  

  You can ask the global meta server for a list of repos (visible to your level) from different
  data sources. You can check, download, fork* or immutably ref all the repos visible to you or
  some files/dirs within these repos, but if you want to modify something within a repo and have
  the change sync to the original repo, you would ask the owner of the repo for a collaborator
  membership and then you can mutably ref either files/directories within that repo or the repo
  itself.  

  You own a repo you created, that means you can check out, push changes to and delete the repo
  as well as invite collaborators who can check and push changes to, but not delete the repo,
  any others are only able to check the repo.  

  *fork: a hard copy of some content to your repo, a forked content is owned by you and changes to
  it will not affect the original. It's like first download the content to your local storage and
  then upload to your own repo.  

- Now, you might have your own repo(s) that might refer to files/dirs from other repos or refs to
  other repos within your workspace, you might want:  

  1. Modifications to your own files/dirs or some 'mutable' refs to be uploaded.  

     This is done by having a watcher at background and notify the program whenever a change has
     been made to these files. Whenever changes to a file is detected, the client program divides
     the file into chunks, calculates their 'fingerprint', and send all of these fingerprints,
     along with the file identification, modification time and other meta data to the data source
     this file resides, the data source then gives possible duplicated chunks of the to-be uploaded
     file, after the client program confirm the duplications, it only sends non-duplicated chunks
     along with meta data to the data source, the data source then reconstruct the new file.
  2. Other users' modifications to your refs or your own files/dirs mutably refed by your repo's 
     collaborators to be synced.  

     This is done by setting up the client program to listen to certain message channels, more
     specifically, we should listen to channels corresponding to the root refs of all the refs
     in your repo, and also a channel dedicated for all non-ref content within our repo.  

     To listen to a channel, we need to send the client's identification, info of the channel we
     want to listen to
      
## Components Services Summaries

Central meta data server services:

- Store info of all data sources and repos stored in these data sources. 
- Provide a way for a user to retrieve this info (or, more precisely, a part of it that the user
  is able to see).
- Info of a data source includes:
  its address, info of all repos it contains
- Info of a repo includes: 
  name(or any identifier), owner, contributor, collaborator, name, visibility level, modification time, revision history
  

## Components Definitions

1. Trivial Data Sources  
   A trivial data source manages a local storage it resides in.

2. Aggregated Data Sources  
   A aggregated data source manages multiple local trivial data sources, caches information
   about remote data sources from the central server (so that clients don't have to frequently
   talk to central servers), stores information of repos resides here.
   It is responsible for handling client requests and forwards any changes to its local
   data sources made by clients to message servers.
  
3. Global Meta Data Server(s)  
   The central server/cluster aggregating information about all (trusted) aggregated data
   sources and clients.  
   It is responsible for (relatively) securely including aggregated data sources and clients
   to the system and providing verifications of aggregated data sources and clients.

4. Message Server(s)  
   Message servers accepts file change messages from all data sources and forwards them
   to clients.

5. CA Server(s) (with OCSP) 
   Provide certificates signing services, store information about all signed certificates
   and also give information about revoked certs.

6. Clients

## Major Flows  

- Servers set up  
  1. All servers required to have a cert need first to get one from CA server.
  2. An aggregated data source broadcast msg to learn about data sources, data sources reply with its
     identify and cert. The aggregated data source then ask about their repo info, which can contain
     refs to remote data sources, the aggregated data source then declare its existence to global meta
     data server by connecting to it, after authentication, the aggregated data source reports some 
     meta info (which client can access it) and its repos and expects the global meta data server to  
     1. Check meta info (e.g. to see if a client is still ok to have an access to the aggregated server)
        and store it.  
     2. Check repo info (e.g. to see if an owner of a repo can still own it) and cache it.  
     4. Give info of remote data sources these repo refers to so that the aggregated server can cache it.
        Later changes of these info should also be sent from the global meta server.  
     
     An aggregated server should also try to connect to a message server to forward info of its repos'
     changes. After authentications, it sends all of its repos' non-ref content info so that the message
     server can make one channel for each of the repos to forward all non-ref content changes of that repo.    

     Since the global meta server caches repo info, an aggregated server should also periodically report
     repo meta data changes, this also serves as a heart beat to let the global meta know everything is
     working correctly.
  3. A data source listens for some aggregated source's polling msg and responds to it accordingly. It also
     should send heartbeat to let the aggregated server know everything is working correctly.  
  4. A global meta server waits for aggregated data sources' connections and record their meta info and caches
     their repo info, note that the list of data sources are written to disk and upon next restart, it would
     respond 'reconnect' to all heart beat msgs, after a while, if these is still a data source in the list
     whose heart beat is not received, a data source failure would be reported.  
     A global meta server also caches data sources' mutation permitted lists, which are also updated via heart
     beat.  
     Note that all of these caches should be confirmed when the client is ready to do real things.  
     A global meta server stores clients info (e.g. email, status, level of privilege, etc.)
  5. 


