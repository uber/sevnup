module.exports = Sevnup;

var _ = require('lodash');
var crypto = require('crypto');
var async = require('async');

var DEFAULT_TOTAL_VNODES = 1024;
var MAX_PARALLEL_TASKS = 10;

/**
 * Params are:
 *   hashRing
 *   loadVNodeKeysFromStorage
 *   persistKeyToVNode
 *   persistRemoveKeyFromVNode
 *   recoverKey
 *   releaseKey
 *   totalVNodes
 *   logger
 */
function Sevnup(params) {
    var self = this;

    this.hashRing = params.hashRing;
    this.hashRingLookup = this.hashRing.lookup.bind(this.hashRing);
    this.loadVNodeKeysFromStorage = params.loadVNodeKeysFromStorage;
    this.persistKeyToVNode = params.persistKeyToVNode;
    this.persistRemoveKeyFromVNode = params.persistRemoveKeyFromVNode;
    this.recoverKeyCallback = params.recoverKey;
    this.releaseKeyCallback = params.releaseKey;
    this.totalVNodes = params.totalVNodes || DEFAULT_TOTAL_VNODES;
    this.logger = params.logger;

    this.ownedVNodes = [];

    this._onRingStateChange(function() {
        self._attachToRing();
    });
}

Sevnup.prototype._attachToRing = function _attachToRing() {
    var self = this;
    this.hashRing.on('changed', this._onRingStateChange.bind(this));
    this.hashRing.lookup = function sevnupLookup(key) {
        var vnode = self._getVNodeForKey(key);
        var node = self.hashRingLookup(vnode);
        if (self.hashRing.whoami() === node) {
            self.persistKeyToVNode(vnode, key, function(err) {
                if (err) {
                    self.logger.error("Sevnup.sevnupLookup failed to persist key", {
                        vnode: vnode,
                        key: key,
                        error: err
                    });
                }
            });
        }
        return node;
    };
};

/**
 * Returns true if this node currently owns vnode.
 * @param {string} vnodeName The name of the vnode to check.
 */
Sevnup.prototype._iOwnVNode = function _iOwnVNode(vnodeName) {
    // Use the non-patched lookup
    var node = this.hashRingLookup(vnodeName);
    return this.hashRing.whoami() === node;
};

Sevnup.prototype._getOwnedVNodes = function _getOwnedVNodes() {
    var results = [];
    for (var i = 0; i < this.totalVNodes; ++i) {
        if (this._iOwnVNode(i)) {
            results.push(i);
        }
    }
    return results;
};

/**
 * Takes a hashRing and subscribes to the correct events to maintain VNode
 * ownership.
 * @param {object} hashRing A ringPop implementation of a hashring.
 */
Sevnup.prototype._onRingStateChange = function _onRingStateChange(done) {
    var oldOwnedVNodes = this.ownedVNodes;
    var newOwnedVNodes = this.ownedVNodes = this._getOwnedVNodes();

    var nodesToRelease = _.difference(oldOwnedVNodes, newOwnedVNodes);
    var nodesToRecover = _.difference(newOwnedVNodes, oldOwnedVNodes);

    this.logger.info('Sevnup._onRingStateChange', {
        releasing: nodesToRelease,
        recovering: nodesToRecover
    });

    async.parallel([
        this._forEachKeyInVNodes.bind(this, nodesToRelease, this._releaseKey.bind(this)),
        this._forEachKeyInVNodes.bind(this, nodesToRecover, this._recoverKey.bind(this))
    ], done);
};

Sevnup.prototype._forEachKeyInVNodes = function _forEachKeyInVNodes(vnodes, onKey, done) {
    var self = this;

    async.eachLimit(vnodes, MAX_PARALLEL_TASKS, onVnode, done);

    function onVnode(vnode, next) {
        async.waterfall([
            self.loadVNodeKeysFromStorage.bind(self, vnode),
            onKeys.bind(null, vnode),
        ], next);
    }

    function onKeys(vnode, keys, next) {
        async.eachLimit(keys, MAX_PARALLEL_TASKS, onKey.bind(null, vnode), next);
    }
};

Sevnup.prototype._recoverKey = function _recoverKey(vnode, key, done) {
    var self = this;

    async.waterfall([
        this.recoverKeyCallback.bind(this, key),
        function(handled, next) {
            if (handled) {
                self.persistRemoveKeyFromVNode(vnode, key, function(err) {
                    if (err) {
                        self.logger.error("Sevnup._recoverKey failed to remove key from vnode", {
                            vnode: vnode,
                            key: key,
                            error: err
                        });
                    }
                    // Swallow
                    next();
                });
            } else {
                next();
            }
        }
    ], function(err) {
        if (err) {
            self.logger.error("Sevnup._recoverKey encountered an error", {
                vnode: vnode,
                key: key,
                error: err
            });
        }
        // Swallow
        done();
    });
};

Sevnup.prototype._releaseKey = function _releaseKey(vnode, key, done) {
    var self = this;
    this.releaseKeyCallback(key, function(err) {
        if (err) {
            self.logger.error("Sevnup._releaseKey encountered an error", {
                vnode: vnode,
                key: key,
                error: err
            });
        }
        // Swallow
        done();
    });
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
    var vnode = this._getVNodeForKey(key);
    this.persistRemoveKeyFromVNode(vnode, key, done);
};

/**
 * Given a key, get the vnode it belongs to.  It can then be routed to the
 * correct node, via looking up by vnode name.
 * @param {string} key The key to match to a vnode.
 */
Sevnup.prototype._getVNodeForKey = function _getVNodeForKey(key) {
    var hash = new Buffer(crypto.createHash('md5').update(key).digest('binary'));
    return hash.readUInt32LE(0) % this.totalVNodes;
};
