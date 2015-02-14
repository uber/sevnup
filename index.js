var async = require('async');

var VNodeStore = require('./lib/vnode-store.js');

/**
 * Constructor, takes all optional persistence function overrides but expects none.
 * @constructor
 * @param {function} loadVNKeysFromStorage A method that takes a vnode and
 *     the list of keys it owns, presumably recovered from a datastore.
 *  @param {function} persistKeyToVNode Given a key and a VNode, this function
 *      adds the relation to the datastore.
 *  @param {function} persistRemoveKeyFromVNode The inverse of
 *      persistKeyToVNode, removes a key relation to a VNode in the store.
 *  @param {function} recoverKey The function to run on each key that is
 *      recovered. Takes 'done' callback.
 *  @param {function} releaseKey The function called when you release your
 *      ownership of a key, for example if another node now owns it.  Cleanup.
 *      Also takes a 'done' callback.
 */
function Sevnup(persistenceService, recoverKey, releaseKey) {
    // TODO: convert to constructor(options), take these too
    this.vnodeCount = 14;
    this.loadLimit = 5;
    this.allVNodes = [];
    for (var i=0; i<this.vnodeCount; i++) {
        this.allVNodes.push(i);
    }
    this.vnodeStore = new VNodeStore(persistenceService, recoverKey, releaseKey);
}

/**
 * Checks each VNode to see if the current node owns it, and if it does it
 * prompts recovery of each key.  For example, it finds that it owns VNode B,
 * recovers 14 keys that the old owner of VNode B was working on, and prompts
 * the client via callback to recover each of those keys, leaving that to the
 * individual client's business logic.
 * @param {function} done The callback when all keys have been loaded.
 */
Sevnup.prototype.loadAllKeys = function loadAllKeys(done) {
    var self = this;
    async.eachLimit(self.allVNodes, self.loadLimit, eachVNode, done);
    function eachVNode(vnode, done) {
        if (self.iOwnVNode(vnode)) {
            self.vnodeStore.loadVNodeKeys(vnode, done);
        } else {
            done();
        }
    }
};

/**
 * When you are done working on a key, or no longer want it within bookkeeping
 * you can alert sevnup to forget it.  This notifies the ring that it doesn't
 * need attention in the event this node goes down or hands off ownership.
 * We want the service to be ignorant of vnodes so we rediscover the vnode.
 * @param {string} key The key you have finished work on.
 * @param {function} done Optional callback if you want to listen to completion
 */
Sevnup.prototype.workCompleteOnKey = function workCompleteOnKey(key, done) {
    var self = this;
    var vnode = self.getVNodeForKey(key);
    self.vnodeStore.removeKeyFromVNode(vnode, key, done);
};

/**
 * Takes a hashRing and subscribes to the correct events to maintain VNode
 * ownership.
 * @param {object} hashRing A ringPop implementation of a hashring.
 */
Sevnup.prototype.attachToRing = function attachToRing(hashRing) {
    var self = this;
    if (self.hashRing) {
        throw new Error('already attached to a hashRing');
    }
    self.hashRing = hashRing;
    self.hashRing.on('changed', self.loadAllKeys);
    self.originalHashRingLookup
    self.origLookup = self.hashRing.lookup;
    self.hashRing.lookup = function lookupKey(key) {
        var vnode = self.getVNodeForKey(key);
        var node = self.origLookup.call(self.hashRing, vnode);
        if (self.hashRing.whoami() === node) {
            self.vnodeStore.addKeyToVNode(vnode, key, function() {
                // XXX this is why the hashRing lookup API should by async, so
                // that any wrapped logic error can fail the entire lookup
                // rather than needing to handle an error out of band
                //TODO (joseph): Logging logger log. Function passes error
            });
        }
        return node;
    };
};

/**
 * Returns true if this node currently owns vnode.
 * @param {string} vnodeName The name of the vnode to check.
 */
Sevnup.prototype.iOwnVNode = function iOwnVNode(vnodeName) {
    // XXX should use origLookup instead? or do we actually want the vnodeStore
    // side-effect?
    var self = this;
    var node = self.hashRing.lookup(vnodeName);
    return self.hashRing.whoami() === node;
};

/**
 * Given a key, get the vnode it belongs to.  It can then be routed to the
 * correct node, via looking up by vnode name.
 * @param {string} key The key to match to a vnode.
 */
Sevnup.prototype.getVNodeForKey = function getVNodeForKey(key) {
    return this.hashCode(key) % this.vnodeCount;
};

/**
 * Given a string, turns it into a 32 bit integer.  To be moved to the utility
 * class.  TODO(joseph): move to utils.
 * @param {string} string the string to convert
 */
Sevnup.prototype.hashCode = function(string) {
    // XXX hy not use a natively implemented hash like farmhash instead? in
    // fact this should be pluggable as an option to the constructor
    var hash = 0;
    var character;
    var length = string.length;
    if (length !== 0) {
        for (var i = 0; i < length; i++) {
            character   = string.charCodeAt(i);
            hash  = ((hash << 5) - hash) + character;
            hash |= 0; 
        }
    }
    return hash;
};

module.exports = Sevnup;
