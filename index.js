module.exports = Sevnup;

var _ = require('lodash');
var farmhash = require('farmhash');
var async = require('async');
var CacheStore = require('./cache_store');

var DEFAULT_TOTAL_VNODES = 1024;
var DEFAULT_CALM_THRESHOLD = 500;
var DEFAULT_RETRY_INTERVAL_MS = 5000;
var MAX_PARALLEL_TASKS = 10;

/**
 * Params are:
 *   hashRing
 *   hashRingLookup (optional)
 *   store
 *   recoverKey
 *   releaseKey
 *   totalVNodes
 *   addOnLookup
 *   logger
 *   watchMode
 */
function Sevnup(params) {
    this.hashRing = params.hashRing;
    this.hashRingLookup = params.hashRingLookup || this.hashRing.lookup.bind(this.hashRing);
    this.store = new CacheStore(params.store);
    this.recoverKeyCallback = params.recoverKey;
    this.releaseKeyCallback = params.releaseKey;
    this.totalVNodes = params.totalVNodes || DEFAULT_TOTAL_VNODES;
    this.logger = params.logger;
    this.statsd = params.statsd;
    this.calmThreshold = params.calmThreshold || DEFAULT_CALM_THRESHOLD;
    this.calmTimeout = null;
    this.watchMode = params.watchMode;
    this.running = true;
    this.retryIntervalMs = params.retryIntervalMs || DEFAULT_RETRY_INTERVAL_MS;
    this.retryRecoverOnFailure = params.retryRecoverOnFailure || false;

    this.ownedVNodes = [];

    this.stateChangeQueue = async.queue(this._handleRingStateChange.bind(this), 1);

    this.eventHandler = this._onRingStateChange.bind(this);
    this._attachToRing(params.addOnLookup);
}

/**
 * Adds a key to sevnup if it belongs to the current worker.
 * @param {string} key The key you want to add.
 * @param {function} done Optional callback if you want to listen to completion
 */
Sevnup.prototype.addKey = function addKey(key, done) {
    var vnode = this.getVNodeForKey(key);
    return this.addKeyToVNode(key, vnode, done);
};

Sevnup.prototype.addKeyToVNode = function addKeyToVNode(key, vnode, done) {
    var self = this;
    var node = this.hashRingLookup(vnode);
    if (this.hashRing.whoami() === node) {
        this.store.addKey(vnode, key, function(err) {
            if (err) {
                self.logger.error("Sevnup.sevnupLookup failed to persist key", {
                    vnode: vnode,
                    key: key,
                    error: err
                });
            }
            if (done) {
                done(err);
            }
        });
    } else if (done) {
        done();
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
    var vnode = this.getVNodeForKey(key);
    this.workCompleteOnKeyInVNode(key, vnode, done);
};

Sevnup.prototype.workCompleteOnKeyInVNode = function workCompleteOnKeyInVNode(key, vnode, done) {
    this.store.removeKey(vnode, key, done);
};

Sevnup.prototype.getOwnedKeys = function getOwnedKeys(done) {
    async.waterfall([
        async.mapLimit.bind(async, this._getOwnedVNodes(), MAX_PARALLEL_TASKS, this.store.loadKeys.bind(this.store)),
        function(keys, next) {
            next(null, _.flatten(keys));
        }
    ], done);
};

Sevnup.prototype._attachToRing = function _attachToRing(addOnLookup) {
    var self = this;

    if (!this.watchMode) {
        this.hashRing.lookup = function sevnupLookup(key) {
            var vnode = self.getVNodeForKey(key);
            var node = self.hashRingLookup(vnode);
            if (addOnLookup) {
                self.addKey(key);
            }
            return node;
        };
    }

    if (this.hashRing.isReady) {
        onReady();
    } else {
        this.hashRing.on('ready', onReady);
    }

    function onReady() {
        self.hashRing.on('ringChanged', self.eventHandler);
        self._onRingStateChange();
    }
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

Sevnup.prototype._onRingStateChange = function _onRingStateChange() {
    var self = this;
    if (!this.running) {
        // Shutdown
        return;
    }
    if (this.stateChangeQueue.length() > 0) {
        // Ring change already queued
        return;
    }
    if (this.calmTimeout) {
        clearTimeout(this.calmTimeout);
    }
    this.calmTimeout = setTimeout(execute, this.calmThreshold);

    function execute() {
        self.stateChangeQueue.push(true);
    }
};

Sevnup.prototype._handleRingStateChange = function _handleRingStateChange(arg, done) {
    var self = this;
    var oldOwnedVNodes = self.ownedVNodes;
    var newOwnedVNodes = self.ownedVNodes = self._getOwnedVNodes();

    var nodesToRelease = _.difference(oldOwnedVNodes, newOwnedVNodes);
    var nodesToRecover = _.difference(newOwnedVNodes, oldOwnedVNodes);

    self.logger.info('Sevnup._onRingStateChange', {
        releasing: nodesToRelease,
        recovering: nodesToRecover
    });

    async.parallel([
        self._forEachKeyInVNodesWithRetry.bind(self, self.retryRecoverOnFailure, nodesToRelease, self._releaseKey.bind(self)),
        self._forEachKeyInVNodesWithRetry.bind(self, self.retryRecoverOnFailure, nodesToRecover, self._recoverKey.bind(self))
    ], function() {
        nodesToRelease.forEach(self.store.releaseFromCache.bind(self.store));
        done();
    });
};

Sevnup.prototype._forEachKeyInVNodesWithRetry = function _forEachKeyInVNodesWithRetry(retryErrors, vnodes, onKey, done) {
    var self = this;

    async.eachSeries(vnodes, onVNode, done);

    function onVNode(vnode, next) {
        async.waterfall([
            function _loadWithRetries(wNext) {
                maybeWithRetry("loadkeys", self.store.loadKeys.bind(self.store, vnode), wNext);
            },
            onKeys.bind(null, vnode),
        ], next);
    }

    function onKeys(vnode, keys, next) {
        async.eachLimit(keys, MAX_PARALLEL_TASKS, function _try(key, eNext) {
            maybeWithRetry("onkey", function _try(cb) {
                onKey(vnode, key, cb);
            }, eNext);
        }, next);
    }

    function maybeWithRetry(retryName, fn, cb) {
        if (retryErrors) {
            self._withRetry(retryName, fn, cb);
        } else {
            fn(function _noRetry() {
                // Ignore errors
                cb.apply(cb, [null].concat(Array.prototype.slice.call(arguments, 1)));
            });
        }
    }
};

Sevnup.prototype._forEachKeyInVNodes = function _forEachKeyInVNodes(vnodes, onKey, done) {
    this._forEachKeyInVNodesWithRetry(false, vnodes, onKey, done);
};

Sevnup.prototype._withRetry = function _withRetry(retryName, fn, done) {
    var self = this;
    fn(function _checkError(err) {
        if (err) {
            self.maybeIncrementStat('sevnup.retrying', {
                type: retryName
            });
            setTimeout(self._withRetry.bind(self, retryName, fn, done), self.retryIntervalMs);
            return;
        }
        done.apply(done, arguments);
    });
};

Sevnup.prototype._recoverKey = function _recoverKey(vnode, key, done) {
    var self = this;

    async.waterfall([
        this.recoverKeyCallback.bind(this, key),
        function(handled, next) {
            if (handled) {
                self.store.removeKey(vnode, key, function(err) {
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
        // We should propogate errors so we can properly retry if we have that setup
        done(err);
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
        // We should propogate errors so we can properly retry if we have that setup
        done(err);
    });
};

/**
 * Given a key, get the vnode it belongs to.  It can then be routed to the
 * correct node, via looking up by vnode name.
 * @param {string} key The key to match to a vnode.
 */
Sevnup.prototype.getVNodeForKey = function getVNodeForKey(key) {
    return farmhash.hash32v1(key) % this.totalVNodes;
};

Sevnup.prototype.destroy = function destroy() {
    clearTimeout(this.calmTimeout);
};

Sevnup.prototype.shutdownAndRelease = function shutdownAndRelease(done) {
    var self = this;
    this.destroy();
    this.running = false;
    this.hashRing.removeListener('ringChanged', this.eventHandler);

    if (this.stateChangeQueue.idle()) {
        releaseAll();
    } else {
        this.stateChangeQueue.drain = releaseAll;
    }

    function releaseAll() {
        self._forEachKeyInVNodes(self.ownedVNodes, self._releaseKey.bind(self), done);
    }
};

Sevnup.prototype.isPotentiallyOwnedKey = function isPotentiallyOwnedKey(key) {
    var vnode = this.getVNodeForKey(key);
    var node = this.hashRingLookup(vnode);
    return this.hashRing.whoami() === node;
};

Sevnup.prototype.maybeIncrementStat = function maybeIncrementStat(statName, tags) {
    if (this.statsd) {
        this.statsd.increment(statName, 1, {
            tags: tags
        });
    }
};
