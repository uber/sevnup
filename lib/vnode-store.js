module.exports = VNodeStore;

var async = require('async');

/**
 * Creates a new VNodeStore object, optionally taking in the persistence hooks
 * needed to save and restore the in-memory vnode set from an external data
 * source.
 * @constructor
 * @param {function} persistenceService.loadVNodeKeysFromStorage The function 
 *    that will return  a set, keyed by VNode name, with a list or set of keys. 
 *    Usually sourced by the datastore.
 * @param {function} persistenceService.persistKeyToVNode The function that 
 *    will take a VNode and a new key and will save the new key out to the 
 *    datastore.  
 * @param {function} persistenceService.persistRemoveKeyFromVNode The inverse 
 *    of persistKeyToVNode, this will remove a key from a VNode's set in the
 *    store.
 * @param {function} recoverKey The method to run when a key is assigned to
 *    the node.
 * @param {function} releaseKey The method to run when you hand off a key to
 *    another node.
 */
function VNodeStore(persistenceService, recoverKey, releaseKey) {
    // TODO: convert to constructor(options)
    this.keyLoadLimit = 5; // TODO: option
    this.vnCache = {};
    if (!persistenceService) {
        throw new Error('missing persistenceService');
    }
    this.loadVNodeKeysFromStorage = persistenceService.loadVNodeKeysFromStorage;
    this.persistKeyToVNode = persistenceService.persistKeyToVNode;
    this.persistRemoveKeyFromVNode = persistenceService.persistRemoveKeyFromVNode;
    this.recoverKey = recoverKey;
    this.releaseKey = releaseKey;
}

/**
 * Adds key stewardship to a VNode.  If the cache doesn't currently know
 * about the VNode, it adds it. 
 * @param {string} vnodeName The name of the virtual node to own the key.
 * @param {string} key The key to be watched by the vnode.
 * @param {function} done The method to be called when persistence is complete.
 */
VNodeStore.prototype.addKeyToVNode = function addKeyToVNode(vnodeName, key, done) {
    var self = this;
    var vnCache = self.vnCache;
    if (!objectContainsKey(vnCache, vnodeName)) {
        vnCache[vnodeName] = {};
    }
    if (!objectContainsKey(vnCache[vnodeName], key) ) {
        self.persistKeyToVNode(vnodeName, key, function(err) {
            if (!err) {
                vnCache[vnodeName][key] = true;
            }
            done(err);
        });
    } else {
        done();
    }
};


/**
 * Removes a key from a VNode's watch, if it exists in the first place.  If
 * a delete operation is actually performed, the persistence callback is
 * triggered.
 * @param {string} vnodeName The name of the vnode to disown the key.
 * @param {string} key The key to be disowned.
 * @param {function} done The callback for once the key was successfully
 *      removed.
 */
VNodeStore.prototype.removeKeyFromVNode = function removeKeyFromVNode(vnodeName, key, done) {
    var self = this;
    if (!objectContainsKey(self.vnCache, vnodeName)) {
        return done();
    }
    if (!objectContainsKey(self.vnCache[vnodeName], key)) {
        return done();
    }
    self.persistRemoveKeyFromVNode(vnodeName, key, function(err) {
        if (!err) {
            delete self.vnCache[vnodeName][key];
        }
        done(err);
    });
};

/**
 * Uses the parameter vnodeKeyArray if exists to set the vnode cache to a Map where
 * the key is a VNode name and the value is a set of keys. If the parameter is
 * not passed, it checks for the overriden method loadVNodeKeysFromStorage to
 * return the same Map from whatever source the client desires.  If neither can
 * provide such a Map, it defaults to setting the cache to an empty object, if
 * none exist.
 * @param {string} vnodeName The name of the vnode to load all the keys for.
 * @param {function} done Callback for when keys have been loaded, optional err
 */
VNodeStore.prototype.loadVNodeKeys = function loadVNodeKeys(vnodeName, done) {
    var self = this;
    self.loadVNodeKeysFromStorage(vnodeName, function(err, keys) {
        self.onKeysLoaded(err, vnodeName, keys, done);
    });
};

/**
 * This is the function called when all keys have been loaded from the datastore.
 * It then uses recoverKey function for the specific business logic that the service
 * wants to call on each key.  If recoverKey passes false as the second
 * parameter to it's callback, we retain the key in bookkeeping.
 * @param {Error} err Error object if any persistence issues when fetching the set.
 * @param {string} vnodeName The name of the vnode who owns the keys.
 * @param {Array} keys The entire array of keys loaded from memory.
 * @param {function} done The method to call when all keys have been handled.
 */
VNodeStore.prototype.onKeysLoaded = function onKeysLoaded(err, vnodeName, keys, done) {
    var self = this;
    var vnodeKeyArray = keys || [];
    // Load all keys to the cache
    self.vnCache[vnodeName] = arrayToSet(vnodeKeyArray);
    if (typeof self.recoverKey !== 'function') {
       // nothing to do, return
       return done();
    }
    async.eachLimit(vnodeKeyArray, self.keyLoadLimit, handleAndClearKey, done);
    function handleAndClearKey(key, eachDone) {
        self.recoverKey(key, function keyRecovered(err, keyHandled) {
            if (err) {
                return eachDone(err);
            }
            if (keyHandled) {
                self.removeKeyFromVNode(vnodeName, key, eachDone);
            } else {
                eachDone();
            }
        });
    }
};

function arrayToSet(array) {
    var set = {};
    for (var i=0; i < array.length; i++) {
        set[array[i]] = true;
    }
    return set;
}

function objectContainsKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
