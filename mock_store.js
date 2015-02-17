module.exports = MockStore;

function MockStore() {
    this.store = {};
}

MockStore.prototype.add = function(vnode, key, done) {
    var set = this.store[vnode];
    if (!set) {
        set = this.store[vnode] = {};
    }
    set[key] = true;
    if (done) {
        done();
    }
};

MockStore.prototype.remove = function(vnode, key, done) {
    var set = this.store[vnode];
    if (set) {
        delete set[key];
    }
    if (done) {
        done();
    }
};

MockStore.prototype.load = function(vnode, done) {
    var set = this.store[vnode];
    var keys = set && Object.keys(set) || [];
    if (done) {
        done(null, keys);
    } else {
        return keys;
    }
};

