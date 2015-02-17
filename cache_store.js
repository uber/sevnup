module.exports = CacheStore;

function CacheStore(store) {
    this.store = store;
    // Only stores sets that have been loaded
    // Contains map of key -> bool, where bool isn't important
    this.cache = {};
}

CacheStore.prototype.addKey = function add(vnode, key, done) {
    var set = this.cache[vnode];
    if (!set) {
        // Hasn't been fully loaded into cache
        return this.store.addKey(vnode, key, done);
    }
    if (set.hasOwnProperty(key)) {
        return done();
    }
    this.store.addKey(vnode, key, function(err) {
        if (!err) {
            set[key] = true;
        }
        done(err);
    });
};

CacheStore.prototype.removeKey = function remove(vnode, key, done) {
    var set = this.cache[vnode];
    // Set is loaded, key is not present.
    // TODO if you want to get really fancy, store a tombstone on remove and check that too.
    if (set && !set.hasOwnProperty(key)) {
        return done();
    }
    this.store.removeKey(vnode, key, function(err) {
        if (!err && set) {
            delete set[key];
        }
        done(err);
    });
};

CacheStore.prototype.loadKeys = function load(vnode, done) {
    var self = this;
    if (this.cache[vnode]) {
        return done(null, Object.keys(this.cache[vnode]));
    }
    this.store.loadKeys(vnode, function(err, keys) {
        if (!err) {
            var set = self.cache[vnode] = {};
            keys.forEach(function(key) {
                set[key] = true;
            });
        }
        done(err, keys);
    });
};

CacheStore.prototype.release = function release(vnode) {
    delete this.cache[vnode];
};
