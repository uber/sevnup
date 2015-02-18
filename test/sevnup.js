var test = require('tape');

var Sevnup = require('../index');
var MockRing = require('../mock_ring');
var MockStore = require('../mock_store');

function createSevnup(params) {
    var sevnup = new Sevnup({
        hashRing: params.ring,
        store: params.store,
        recoverKey: params.recover,
        releaseKey: params.release,
        logger: params.logger || console,
        totalVNodes: params.totalVNodes
    });
    return sevnup;
}

function sevnupFlow(assert, earlyReady) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A',
        1: 'A',
        2: 'B'
    });

    var store = new MockStore();
    store.addKey(0, 'k1');
    store.addKey(0, 'k2');
    store.addKey(1, 'k3');
    store.addKey(2, 'k4');

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

    if (earlyReady) {
        ring.ready();
    }

    createSevnup({
        store: store,
        ring: ring,
        recover: recover,
        release: release
    });

    if  (!earlyReady) {
        ring.ready();
    }
    setTimeout(checkRecovery, 100);

    function checkRecovery() {
        assert.deepEqual(recovered.sort(), ['k1', 'k2', 'k3']);
        assert.deepEqual(released, []);
        assert.deepEqual(store.loadKeys(0), ['k2']);
        assert.deepEqual(store.loadKeys(1), ['k3']);
        assert.deepEqual(store.loadKeys(2), ['k4']);

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
        assert.deepEqual(store.loadKeys(0), ['k2']);
        assert.deepEqual(store.loadKeys(1), ['k3']);
        assert.deepEqual(store.loadKeys(2), ['k4']);
        assert.end();
    }
}

test('Sevnup initial recovery, then recovery and release as ring state changes - late ready', function(assert) {
    sevnupFlow(assert, false);
});

test('Sevnup initial recovery, then recovery and release as ring state changes - early ready', function(assert) {
    sevnupFlow(assert, true);
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
    ring.ready();

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        setTimeout(check, 100);
    }, 100);

    function check() {
        assert.deepEqual(store.loadKeys(0), ['derp']);
        assert.end();
    }
});

test('Sevnup attached lookup handles error', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey = function(node, key, done) {
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
    ring.ready();

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
    store.addKey = function() {
        assert.fail();
    };
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1
    });
    ring.ready();

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        assert.end();
    });
});

test('Sevnup._recoverKey handles recoverKey error', function(assert) {
    var logged;
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
    var logged;
    var sevnup = {
        recoverKeyCallback: function(key, done) {
            done(null, true);
        },
        store: {
            removeKey: function(vnode, key, done) {
                done(new Error('fail'));
            }
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
    var logged;
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
    store.addKey(0, 'k1');
    store.addKey(0, 'k2');

    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function(key, done) {
            done(null, false);
        }
    });
    ring.ready();
    sevnup.workCompleteOnKey('k1', function(err) {
        assert.ifErr(err);
        assert.deepEqual(store.loadKeys(0), ['k2']);
        assert.end();
    });
});
