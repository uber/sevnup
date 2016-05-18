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
        totalVNodes: params.totalVNodes,
        calmThreshold: 1 || params.calmThreshold,
        addOnLookup: params.addOnLookup
    });
    return sevnup;
}

test('Sevnup default params', function(assert) {
    var ring = new MockRing('A');
    var sevnup = new Sevnup({
        hashRing: ring,
        store: {}
    });
    assert.ok(sevnup.calmThreshold);
    assert.ok(sevnup.totalVNodes);
    assert.end();
});

test('Sevnup watch mode', function(assert) {
    var ring = new MockRing('A');
    var sevnup = new Sevnup({
        hashRing: ring,
        store: {},
        watchMode: true
    });
    assert.ok(sevnup.calmThreshold);
    assert.ok(sevnup.totalVNodes);
    assert.deepEqual(sevnup.hashRing.lookup, MockRing.prototype.lookup, 'Lookup didn\'t change');
    assert.end();
});

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

    var sevnup = createSevnup({
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
        sevnup.getOwnedKeys(function(err, keys) {
            assert.ifErr(err);
            assert.deepEqual(keys.sort(), ['k2', 'k3']);

            ring.changeRing({
                0: 'B',
                1: 'B',
                2: 'A'
            });
            setTimeout(checkRingChange, 100);
        });
    }

    function checkRingChange() {
        assert.deepEqual(recovered.sort(), ['k4']);
        assert.deepEqual(released.sort(), ['k2', 'k3']);
        assert.deepEqual(store.loadKeys(0), ['k2']);
        assert.deepEqual(store.loadKeys(1), ['k3']);
        assert.deepEqual(store.loadKeys(2), ['k4']);
        sevnup.getOwnedKeys(function(err, keys) {
            assert.ifErr(err);
            assert.deepEqual(keys.sort(), ['k4']);
            assert.end();
        });
    }
}

test('Sevnup initial recovery, then recovery and release as ring state changes - late ready', function(assert) {
    sevnupFlow(assert, false);
});

test('Sevnup initial recovery, then recovery and release as ring state changes - early ready', function(assert) {
    sevnupFlow(assert, true);
});

test('Sevnup attached lookup persists owned key if addOnLookup true', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        addOnLookup: true
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

test('Sevnup attached lookup does not persist owned key if addOnLookup false', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        addOnLookup: false
    });
    ring.ready();

    setTimeout(function() {
        assert.equal(ring.lookup('derp'), 'A');
        setTimeout(check, 100);
    }, 100);

    function check() {
        assert.deepEqual(store.loadKeys(0), []);
        assert.end();
    }
});

test('Sevnup addKey handles error', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey = function(node, key, done) {
        done(new Error('fail'));
    };
    var logged = false;
    var sevnup = createSevnup({
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
    sevnup.addKey('derp');
    sevnup.addKey('derp', function(err) {
        assert.equal(err.message, 'fail');
        assert.ok(logged);
        assert.end();
    });
});

test('Sevnup addKey does nothing if the key does not belong to sevnup', function(assert) {
    var ring = new MockRing('B');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey = function() {
        assert.fail();
    };
    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1
    });
    sevnup.addKey('derp');
    sevnup.addKey('derp', function(err) {
        assert.ifErr(err);
        assert.notOk(sevnup.isPotentiallyOwnedKey('derp'));
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

test('Sevnup._onRingStateChange waits for calm before processing ring state change', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey(0, 'k1');

    var recovers = 0;
    var releases = 0;
    var logs = 0;
    createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function(key, done) {
            recovers++;
            done(null, false);
        },
        release: function(key, done) {
            releases++;
            done();
        },
        logger: {
            info: function() {
                logs++;
            }
        },
        calmThreshold: 200
    });
    ring.ready();
    ring.changeRing({
        0: 'B'
    });
    ring.changeRing({
        0: 'A'
    });
    ring.changeRing({
        0: 'B'
    });
    ring.changeRing({
        0: 'A'
    });
    ring.changeRing({
        0: 'B'
    });
    ring.changeRing({
        0: 'A'
    });
    setTimeout(checkResults, 300);
    function checkResults() {
        assert.equal(recovers, 1);
        assert.equal(releases, 0);
        assert.equal(logs, 1);
        assert.end();
    }
});

test('Sevnup._onRingStateChange limits to one queued state change update', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey(0, 'k1');

    var recovers = 0;
    var releases = 0;
    var logs = 0;
    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function() {
            recovers++;
        },
        release: function() {
            releases++;
        },
        logger: {
            info: function() {
                logs++;
            }
        },
        calmThreshold: 0
    });
    ring.ready();
    setTimeout(function() {
        ring.changeRing({
            0: 'B'
        });
        setTimeout(checkResults, 10);
    }, 10);

    function checkResults() {
        ring.changeRing({
            0: 'A'
        });
        assert.equal(sevnup.stateChangeQueue.length(), 1);
        assert.equal(recovers, 1);
        assert.equal(releases, 0);
        assert.equal(logs, 1);
        assert.end();
    }
});

test('Sevnup.destroy stops timers', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey(0, 'k1');

    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function() {
            assert.fail();
        },
        release: function() {
            assert.fail();
        },
        logger: {
            info: function() {
                assert.fail();
            }
        },
        calmThreshold: 200
    });
    ring.ready();
    sevnup.destroy();
    setTimeout(checkResults, 300);
    function checkResults() {
        assert.end();
    }
});

test('Sevnup.shutdownAndRelease when idle', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey(0, 'k1');

    var recovers = 0;
    var releases = 0;
    var logs = 0;
    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function(k, done) {
            recovers++;
            done(null, false);
        },
        release: function(k, done) {
            releases++;
            done();
        },
        logger: {
            info: function() {
                logs++;
            }
        },
        calmThreshold: 0
    });
    ring.ready();
    setTimeout(function() {
        setTimeout(checkResults, 10);
    }, 10);

    function checkResults() {
        assert.equal(recovers, 1);
        assert.equal(releases, 0);
        assert.equal(logs, 1);
        sevnup.shutdownAndRelease(function() {
            assert.equal(releases, 1, 'released on shutdown');
            assert.end();
        });
    }
});

test('Sevnup.shutdownAndRelease when updating', function(assert) {
    var ring = new MockRing('A');
    ring.changeRing({
        0: 'A'
    });
    var store = new MockStore();
    store.addKey(0, 'k1');

    var cont;

    var recovers = 0;
    var releases = 0;
    var logs = 0;
    var sevnup = createSevnup({
        store: store,
        ring: ring,
        totalVNodes: 1,
        recover: function(k, done) {
            recovers++;
            cont = function() { done(null, false); };
        },
        release: function(k, done) {
            releases++;
            done();
        },
        logger: {
            info: function() {
                logs++;
            }
        },
        calmThreshold: 0
    });
    ring.ready();
    setTimeout(function() {
        setTimeout(checkResults, 10);
    }, 10);

    function checkResults() {
        assert.notOk(sevnup.stateChangeQueue.idle());
        assert.equal(recovers, 1);
        assert.equal(releases, 0);
        assert.equal(logs, 1);
        sevnup.shutdownAndRelease(function() {
            setTimeout(function() {
                assert.equal(releases, 1, 'released on shutdown');
                assert.end();
            }, 10);
        });
        cont();
    }
});
