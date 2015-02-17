module.exports = CacheStore;

var _ = require('lodash');

function CacheStore(store) {
    this.store = store;
    // Only stores sets that have been loaded
    // Contains map of key -> bool, where bool isn't important
    this.cache = Object.create(null);
}

CacheStore.prototype.addKey = function addKey(vnode, key, done) {
    if (!_.has(this.cache, vnode)) {
        // Hasn't been fully loaded into cache
        return this.store.addKey(vnode, key, done);
    }
    var set = this.cache[vnode];
    if (_.has(set, key)) {
        return done();
    }
    this.store.addKey(vnode, key, function(err) {
        if (!err) {
            set[key] = true;
        }
        done(err);
    });
};

CacheStore.prototype.removeKey = function removeKey(vnode, key, done) {
    // Set is loaded, key is not present.
    // TODO if you want to get really fancy, store a tombstone on remove and check that too.
    if (_.has(this.cache, vnode) && !_.has(this.cache[vnode], key)) {
        return done();
    }
    var set = this.cache[vnode];
    this.store.removeKey(vnode, key, function(err) {
        if (!err && set) {
            delete set[key];
        }
        done(err);
    });
};

CacheStore.prototype.loadKeys = function loadKeys(vnode, done) {
    var self = this;
    if (_.has(this.cache, vnode)) {
        return done(null, Object.keys(this.cache[vnode]));
    }
    this.store.loadKeys(vnode, function(err, keys) {
        if (!err) {
            var set = self.cache[vnode] = Object.create(null);
            keys.forEach(function(key) {
                set[key] = true;
            });
        }
        done(err, keys);
    });
};

CacheStore.prototype.releaseFromCache = function releaseFromCache(vnode) {
    delete this.cache[vnode];
};
