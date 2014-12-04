# sevnup

<!--
    [![build status][build-png]][build]
    [![Coverage Status][cover-png]][cover]
    [![Davis Dependency status][dep-png]][dep]
-->

<!-- [![NPM][npm-png]][npm] -->

<!-- [![browser support][test-png]][test] -->

Sevnup serves as a way to hand off ownership of certain objects when a node in
a hashring goes down, or another node takes ownership of the keyspace.  This
lets you kill nodes without losing track of the current objects it was working
on.  You can use it for arbitrary things, but its power comes
from a `recover` function, which lets you implement any business logic you like
on a specific key.  That specific key is one that sevnup brings to your
attention, because you (the node) now own it and it had not been marked as 'finished' in
the previous owner's logic.

## Usage
Using sevnup should be simple and transparent.  One only needs to teach it how
to persist it's data, attach it to your hash ring implementation, and tell it 
what to do with recovered keys when necessary.

Starting with teaching it persistence.  Sevnup works exclusively with key:set
pairs.  For example:
```
A -> {1,2,3}
C -> {2}
B -> {99,12}
```

The first class 'keys' in this set are A,C,B.  Internally, sevnup considers
these virtual node names: 1, 2 and 3 are the keys that virtual node A owns.
This is a library implementation detail that a user of sevnup shouldn't have to
be concerned with.  A client only needs to be sure that it can persist
a datastructure like the one above.

If you want it to survive memory or process failure, you need to
teach it how to persist such a set.  You can implement this in a datastore - or
in memory cache - as you like, but the contract remains the same. First we need
to show sevnup how to load a set, given a key.  In the example above, a virtual
node would be A, C, or B.  So we'll show it how to load the corresponding sets.

```js
var sevnup = require("sevnup");

/*
 * Note that this will return an array of keys fetched from the database with
 * this virtual node name.  In the example above, that could be A, C or B.
 */
sevnup.loadVNodeKeys = function(vnodeName) {
   // Fetch  all keys in the set that belong to vnodeName from your data store.
   return [];
}
```

## Installation

`npm install sevnup`

## Tests

`npm test`

## Contributors

 - joseph


## MIT Licenced

  [build-png]: https://secure.travis-ci.org/uber/sevnup.png
  [build]: https://travis-ci.org/uber/sevnup
  [cover-png]: https://coveralls.io/repos/uber/sevnup/badge.png
  [cover]: https://coveralls.io/r/uber/sevnup
  [dep-png]: https://david-dm.org/uber/sevnup.png
  [dep]: https://david-dm.org/uber/sevnup
  [test-png]: https://ci.testling.com/uber/sevnup.png
  [tes]: https://ci.testling.com/uber/sevnup
  [npm-png]: https://nodei.co/npm/sevnup.png?stars&downloads
  [npm]: https://nodei.co/npm/sevnup
