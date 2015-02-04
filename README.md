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
to persist its data, attach it to your hash ring implementation, and tell it 
what to do with recovered keys when necessary.

Starting with teaching it persistence.  Sevnup works exclusively with key:set
pairs.  For example:
```
A -> {1,2,3}
C -> {2}
B -> {99,12}
```



The first class 'keys' in this set are `A`,`C`,`B`.  Internally, sevnup considers
these virtual node names: `1`, `2` and `3` are the keys that virtual node `A` owns.
This is a library implementation detail that a user of sevnup shouldn't have to
be concerned with.  A client only needs to be sure that it can persist
a datastructure like the one above.



### I. Load Virtual Node Keys
If you want it to survive memory or process failure, you need to
teach it how to persist such a set.  You can implement this in a datastore - or
in memory cache - as you like, but the contract remains the same. First we need
to show sevnup how to load a set, given a key.  In the example above, a virtual
node would be A, C, or B.  So we'll show it how to load the corresponding sets.

```js
var sevnup = require("sevnup")();

/*
 * Note that this will return an array of keys fetched from the database with
 * this virtual node name.  In the example above, that could be A, C or B.
 */
sevnup.loadVNodeKeys = function(vnodeName, onKeysLoaded) {
   // Fetch  all keys in the set that belong to vnodeName from your data store.
   onKeysLoaded(err, allKeys);
}
```



### II. Add A Key To A Virtual Node
You need to be able to persist ownership of a key.  To do this, you need to
provide a function that takes - as above - a `vnodeName` and a string value
`key` that you want to be added.  In the example set above, if your function
were called with parameters `A` and `6`, the set in your datastore should now
appear as:
```
A -> {1,2,3,6}
```

Implementing the function is simple.  You simply provide the function to
sevnup. Note that we use a 'fake' set for performance reasons, instead of
a javascript array.  In the future, arrays will be supported as well, but for
now, sevnup expects a javascript 'set'.
```js
var persistKeyToVNode = function(vnodeName, key) {
    // Depending on datastore implementation, this can vary.  
    // We'll use pseudo code below to make it more clear.
    var vnodeKeys = datastore.getSet(vnodeName);
    if( !(Object.prototype.hasOwnProperty(vnodeKeys, key)) ) {
        vnodeKeys[key] = true;
    }
    datastore.saveSet(vnodeName, vnodeKeys);
};
```



### III. Remove A Key from a Virtual Node
You need to also do the reverse.  This is simple.  In the same example, using
set `A`, we will pseudocode the removal of the key.
```js
var persistRemoveKeyFromVNode = function(vnodeName, key) {
    var vnodeKeys = datastore.getSet(vnodeName);
    if( Object.prototype.hasOwnProperty(vnodeKeys, key) ) {
        delete vnodeKeys[key];
    }
};
```


### IV. The Business End
Your code successfully manages state of the keys it owns, and will
load and remove keys as they are dealt with.  But currently, you're not dealing
with anything.  If - when your process comes up or is given a new set of keys
in the keyspace to manage - you want to perform some checks to see if the
states of the objects pointed to by the keys are okay, then you need to provide
a recover function.  This method will be called whenever your process is told
to "check out" a certain key.  For example, a node in the ring goes down, all
of a sudden you are now responsible for some of the objects it was dealing
with.  For each of the objects you now need to take over, sevnup will call your
recover function, where you can do what you like with your new objects.
```js
var recover = function(key) {
    var entityHandled = false;
    var myEntity = datastore.getEntity(key);
    if( myEntity.state === 'terrible' ) {
        // business logics...
        entityHandled = true;
    }
    return entityHandled;
};
```
Important note: this function returns true or false.  It does not have to be in
the pattern above.  If your recover function returns `true`, then sevnup will
assume that - even if your process were to die - no one needs to return to that
object to check its state again.  Essentially it says 'we are done with this
key/object.'  If you are about to start processing this object, for example,
you wouldn't want to return true until you were done processing it.  If your
application or node were to go down in the interim, no one would pick up where
you left off.  So be sure to return `true` only once you're done recovering!



### V. Finish
Last, we make sure that we attach sevnup to the hashring implementation you are
using.  This is simple:

```js
var Sevnup = require('sevnup');
var hashring = require('myhashringimplementation');

var sevnup = new SevnUp(
    loadVNodeKeys,
    persistKeyToVNode,
    persistRemoveKeyFromVNode,
    recover
);

sevnup.attachToHashRing(hashring);
```
This assumes the hashring implementation has a 'changed' event that is
triggered when the state of the ring changes.

That's a full (sans implementation of the functions we talked about above) set up of sevnup.
From then on, you can use your hashring as you always would, and know that whenever
a node dies, the keys it was working on will be called in your `recover` method
on another node.

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
