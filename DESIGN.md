# stream replicator algorithm

0. open a duplex multiplexed stream
 - multiplex channels:
    - info: control flow/metadata channel
    - diff: used for sending question/answer diff messages
    - nodes: used to send actual node data
1. each side sends a handshake message over the info channel
2. handshake includes: mode, count, hash, gzip
  - mode: push, pull, sync
  - count: total number of nodes you are representing
  - hash: canonical sha256 of all the head hashes
  - gzip: is the nodes channel gzipped or not
3. once you receive the other persons handshake
  - only gzip if both sides gzip
  - if both are push, or both sides arr pull, its an error
4. person with least number of nodes does the diffing
  - otherwise you choose whoevers hash sorts higher
  - if hashes match then you are in sync
  - other person is the answerer
5. peer who is the differ opens the diff channel
6. interactive diffing happens
7. after diffing the differ now knows what nodes are missing
8. the differ shares the missing hashes with the other side
  - missing nodes are represented by 'since hashes'
  - since nodes can be thought of as heads of the shared subset
  - the differ writes each since hash individually over the info channel
  - after writing these, the info channel is gracefully closed by differ
9. both peers now know which subset of the graph is shared/missing
10. node data is exchanged
  - if you're pushing or syncing, start sending data
    - first send the number of nodes you're going to send on the nodes channel
    - then write each node to the nodes channel
    - if gzipped, the entire nodes channel is a gzipped streams
    - multiplexer handles length prefixing node data
    - if gzipped, you must length prefix the nodes to preserve framing
    - when done sending nodes, close the nodes channel
  - if you're receiving
    - wait for nodes channel to emit data
    - write node data into your graph
    - you should derive your keys from the node data
  - if you're syncing
    - do both of the above cases
11. replication is finished
