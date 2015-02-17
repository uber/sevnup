module.exports = CacheStore;

function CacheStore(store) {
    this.store = store;
    // Only stores sets that have been loaded
    // Contains map of key -> bool, where bool isn't important
    this.cache = {};
}

CacheStore.prototype.add = function add(vnode, key, done) {
    var set = this.cache[vnode];
    if (!set) {
        // Hasn't been fully loaded into cache
        return this.store.add(vnode, key, done);
    }
    if (set.hasOwnProperty(key)) {
        return done();
    }
    this.store.add(vnode, key, function(err) {
        if (!err) {
            set[key] = true;
        }
        done(err);
    });
};

CacheStore.prototype.remove = function remove(vnode, key, done) {
    var set = this.cache[vnode];
    // Set is loaded, key is either not present or marked deleted
    // Or, market previously removed
    if (set && !set.hasOwnProperty(key)) {
        return done();
    }
    this.store.remove(vnode, key, function(err) {
        if (!err && set) {
            delete set[key];
        }
        done(err);
    });
};

CacheStore.prototype.load = function load(vnode, done) {
    var self = this;
    if (this.cache[vnode]) {
        return done(null, Object.keys(this.cache[vnode]));
    }
    this.store.load(vnode, function(err, keys) {
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
