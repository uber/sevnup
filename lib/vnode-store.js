var async = require('async');

var utils = require('./utils.js');

//TODO (joseph@): Config.
var MAX_PARALLEL_TASKS = 5;
var TOTAL_VNODES = 14;

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
    var allVNodesArray = [];
    for (var i=0; i<TOTAL_VNODES; i++) {
        allVNodesArray.push(i);
    }
    this.allVNodesArray = allVNodesArray;
    this.vnCache = {};
    this.loadVNodeKeysFromStorage = persistenceService ?
        persistenceService.loadVNodeKeysFromStorage : undefined;
    this.persistKeyToVNode = persistenceService ? 
        persistenceService.persistKeyToVNode : undefined;
    this.persistRemoveKeyFromVNode = persistenceService ?
        persistenceService.persistRemoveKeyFromVNode : undefined;
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
    if (!self._objectContainsKey(vnCache, vnodeName)) {
        vnCache[vnodeName] = {};
    }
    if (!self._objectContainsKey(vnCache[vnodeName], key) ) {
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
    if (self._objectContainsKey(self.vnCache, vnodeName) &&
            self._objectContainsKey(self.vnCache[vnodeName], key)) {
        self.persistRemoveKeyFromVNode(vnodeName, key, function(err) {
            if (!err) {
                delete self.vnCache[vnodeName][key];
            }
            done(err);
        });
    } else {
        done();
    }
};

/**
 * Checks each VNode to see if the current node owns it, and if it does it
 * prompts recovery of each key.  For example, it finds that it owns VNode B,
 * recovers 14 keys that the old owner of VNode B was working on, and prompts
 * the client via callback to recover each of those keys, leaving that to the
 * individual client's business logic.
 * @param {function} done The callback when all keys have been loaded.
 */
VNodeStore.prototype.loadAllKeys = function loadAllKeys(done) {
    var self = this;
    var allVNodesArray = self.allVNodesArray;
    var myVNodes = self.vnCache || {};
    var newVNodes = {};
    // build list of new vnodes owned
    for(var i=0; i < allVNodesArray.length; i++) {
        var vnode = allVNodesArray[i];
        if ( self.iOwnVNode(allVNodesArray[i]) ) {
            newVNodes[vnode] = {};
        }
    }

    var nodesForRelease = utils.inHashAnotB(myVNodes, newVNodes);
    var nodesToRecover = utils.inHashAnotB(newVNodes, myVNodes);

    async.parallel([
        function(parallelDone) {
            self._releaseVNodes(nodesForRelease, parallelDone);
        },
        function(parallelDone) {
            self._recoverVNodes(nodesToRecover, parallelDone);
        }

    ],
    function (err, results) {
        done(err, results);
    });
};

VNodeStore.prototype._releaseVNodes = function releaseVNodes(vnodes, done) {
    var self = this;
    self._handleVNodes(vnodes, self.releaseVNodeKeys, done);
};

VNodeStore.prototype._recoverVNodes = function recoverVNodes(vnodes, done) {
    var self = this;
    self._handleVNodes(vnodes, self.loadVNodeKeys, done);
};

/**
 * When a VNode needs to have something done to it, this function is called
 * with a handler specifying exactly what to do, for example release the node
 * or recover the node from another.  The base logic is so similar that
 * specific functions like _releaseVNodes and _recoverVNodes are kept minimal.
 * @param {array} vnodes The vnodes to handle.
 * @param {function} handler The handler that takes a vnodeName and callback as
 *     parameters.
 * @param {function} done The callback to call when all vnodes are handled.
 */
VNodeStore.prototype._handleVNodes = function handleVNodes(vnodes, handler, done) {
    async.eachLimit(
        vnodes,
        MAX_PARALLEL_TASKS,
        function (vnode, eachDone) {
            handler(vnode, eachDone);
        },
        function (err) {
            done(err);
        }
    );
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
        self.onKeysLoaded(err, vnodeName, keys, function(err){
            done(err);
        });
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
    self.vnCache[vnodeName] = self._arrayToSet(vnodeKeyArray);
    if (typeof self.recoverKey === 'function') {
       async.eachLimit(vnodeKeyArray, MAX_PARALLEL_TASKS,
            function handleAndClearKey(key, eachDone) {
                async.waterfall([
                    function handleKey(handleKeyDone) {
                        self.recoverKey(key, handleKeyDone);
                    },
                    function handleKeyCompletion(keyHandled, handleDone) {
                        if (keyHandled) {
                            self.removeKeyFromVNode(vnodeName, key, handleDone);
                        } else {
                            handleDone();
                        }
                    }],
                    function waterfallComplete(err, result) {
                        eachDone(err, result);
                });
      }, function keysDone(err) {
            done(err);
      });
   } else {
       // nothing to do, return
       done();
    }
};

/**
 * When a vnode is no longer controlled by this particular hashring node, we 
 * want to relinquish ownership.
 * @param {string} vnodeName The name of the vnode to load all the keys for.
 * @param {function} done Callback for when keys have been loaded, optional err
 */
VNodeStore.prototype.releaseVNodeKeys = function releaseVNodeKeys(vnodeName, done) {
    var self = this;
    self.loadVNodeKeysFromStorage(vnodeName, function(err, keys) {
        self.onKeysLoadedForRelease(err, vnodeName, keys, function(err){
            done(err);
        });
    });
};

/**
 * When we have loaded the keys we are releasing ownership of, we want to
 * delete them from our local cache and call the release function on each to
 * tie up loose ends.
 * @param {Error} err Error object if any persistence issues when fetching the set.
 * @param {string} vnodeName The name of the vnode who owns the keys.
 * @param {Array} keys The entire array of keys loaded from memory.
 * @param {function} done The method to call when all keys have been handled.
 */
VNodeStore.prototype.onKeysLoadedForRelease = function onKeysLoadedForRelease(err, vnodeName, keys, done) {
    var self = this;
    var vnodeKeyArray = keys || [];
    // Remove all keys to the cache
    self.vnCache[vnodeName] = self._arrayToSet(vnodeKeyArray);
    delete self.vnCache[vnodeName];
    if (typeof self.releaseKey === 'function') {
       async.eachLimit(vnodeKeyArray, MAX_PARALLEL_TASKS,
            function handleAndClearKey(key, eachDone) {
                self.releaseKey(key, eachDone);
      }, function keysDone(err) {
            done(err);
      });
   } else {
       // nothing to do, return
       done();
   }
};

/**
 * A helper method to check if the object/map has the key requested, without
 * getting an accidental hit on an Object base property or method.  If it ends
 * up being used elsewhere in the code, should probably move to a helper file,
 * but currently it's assigned to this class to avoid the function being
 * garbage collected.
 * @param {object} object Any object, to be checked for the peresence of key.
 * @param {string} key Any string, checks to see if the object contains that
 *    that property.
 */
VNodeStore.prototype._objectContainsKey = function _objectContainsKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
};

/**
 * A helper method to turn an array, which will often be returned from the
 * datastore callbacks, to a set, which is more optimal for searching.
 * @param {object} array A list of items to be added to the set as keys.
 */
VNodeStore.prototype._arrayToSet = function _arrayToSet(array) {
    var set = {};
    for (var i=0; i < array.length; i++) {
        set[array[i]] = true;
    }
    return set;
};

module.exports = VNodeStore;
