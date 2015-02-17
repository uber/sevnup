var test = require('tape');

var Sevnup = require('../index');
var MockRing = require('../mock_ring');

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

function createSevnup(params) {
    var sevnup = new Sevnup({
        hashRing: params.ring,
        loadVNodeKeysFromStorage: params.store.load.bind(params.store),
        persistKeyToVNode: params.store.add.bind(params.store),
        persistRemoveKeyFromVNode: params.store.remove.bind(params.store),
        recoverKey: params.recover,
        releaseKey: params.release,
        logger: params.logger || console,
        totalVNodes: params.totalVNodes
    });
    return sevnup;
}

test('Sevnup initial recovery, then recovery and release as ring state changes', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A',
        1: 'A',
        2: 'B'
    });

    var store = new MockStore();
    store.add(0, 'k1');
    store.add(0, 'k2');
    store.add(1, 'k3');
    store.add(2, 'k4');

    var recovered = [];
    function recover(key, done) {
        recovered.push(key);
        done(null, key === 'k1');
    }

    var released = [];
    function release(key, done) {
        released.push(key);
        done();
    }

    createSevnup({
        store: store,
        ring: ring,
        recover: recover,
        release: release
    });
    setTimeout(checkRecovery, 100);

    function checkRecovery() {
        assert.deepEqual(recovered.sort(), ['k1', 'k2', 'k3']);
        assert.deepEqual(released, []);
        assert.deepEqual(store.load(0), ['k2']);
        assert.deepEqual(store.load(1), ['k3']);
        assert.deepEqual(store.load(2), ['k4']);

        released = [];
        recovered = [];

        ring.changeRing({
            0: 'B',
            1: 'B',
            2: 'A'
        });
        setTimeout(checkRingChange, 100);
    }

    function checkRingChange() {
        assert.deepEqual(recovered.sort(), ['k4']);
        assert.deepEqual(released.sort(), ['k2', 'k3']);
        assert.deepEqual(store.load(0), ['k2']);
        assert.deepEqual(store.load(1), ['k3']);
        assert.deepEqual(store.load(2), ['k4']);
        assert.end();
    }
});

test('Sevnup attached lookup persists owned key', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1
    });

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        setTimeout(check, 100);
    }, 100);

    function check() {
        assert.deepEqual(store.load(0), ['derp']);
        assert.end();
    }
});

test('Sevnup attached lookup handles error', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.add = function(node, key, done) {
        done(new Error('fail'));
    };
    var logged = false;
    createSevnup({
        store: store,
        ring: ring,
        logger: {
            info: function() {},
            error: function() {
                logged = true;
            }
        },
        totalVNodes: 1
    });

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        setTimeout(check, 100);
    });

    function check() {
        assert.ok(logged);
        assert.end();
    }
});

test('Sevnup attached lookup does nothing if the key does not belong to sevnup', function(assert) {
    var ring = new MockRing('B');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.add = function() {
        assert.fail();
    };
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1
    });

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        assert.end();
    });
});

test('Sevnup._recoverKey handles recoverKey error', function(assert) {
    var logged = true;
    var sevnup = {
        recoverKeyCallback: function(key, done) {
            done(new Error('test'));
        },
        logger: {
            error: function() {
                logged = true;
            }
        }
    };
    Sevnup.prototype._recoverKey.call(sevnup, 'V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(logged);
        assert.end();
    });
});

test('Sevnup._recoverKey handles removeKey error', function(assert) {
    var logged = true;
    var sevnup = {
        recoverKeyCallback: function(key, done) {
            done(null, true);
        },
        persistRemoveKeyFromVNode: function(vnode, key, done) {
            done(new Error('fail'));
        },
        logger: {
            error: function() {
                logged = true;
            }
        }
    };
    Sevnup.prototype._recoverKey.call(sevnup, 'V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(logged);
        assert.end();
    });
});

test('Sevnup._releaseKey handles error', function(assert) {
    var logged = true;
    var sevnup = {
        releaseKeyCallback: function(key, done) {
            done(new Error('fail'));
        },
        logger: {
            error: function() {
                logged = true;
            }
        }
    };
    Sevnup.prototype._releaseKey.call(sevnup, 'V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(logged);
        assert.end();
    });
});

test('Sevnup.workCompleteOnKey removes key from vnode', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.add(0, 'k1');
    store.add(0, 'k2');

    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function(key, done) {
            done(null, false);
        }
    });
    sevnup.workCompleteOnKey('k1', function(err) {
        assert.ifErr(err);
        assert.deepEqual(store.load(0), ['k2']);
        assert.end();
    });
});
