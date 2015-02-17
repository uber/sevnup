var test = require('tape');

var CacheStore = require('../cache_store');

test('CacheStore.addKey does not use the cache if it has not been loaded', function(assert) {
    var hit;
    var store = {
        addKey: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        }
    };

    var cache = new CacheStore(store);
    cache.addKey('V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(hit);
        hit = false;
        cache.addKey('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            assert.end();
        });
    });
});

test('CacheStore.addKey uses the cache if loaded', function(assert) {
    var hitAdd;
    var hitLoad;
    var store = {
        addKey: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hitAdd = true;
            done();
        },
        loadKeys: function(vnode, done) {
            hitLoad = true;
            done(null, []);
        }
    };

    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err) {
        assert.ifErr(err);
        assert.ok(hitLoad);
        cache.addKey('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hitAdd);
            hitAdd = false;
            cache.addKey('V', 'K', function(err) {
                assert.ifErr(err);
                assert.notOk(hitAdd);
                assert.end();
            });
        });
    });
});

test('CacheStore.addKey does not cache if error', function(assert) {
    var hitAdd;
    var hitLoad;
    var store = {
        addKey: function(vnode, key, done) {
            hitAdd = true;
            done(new Error());
        },
        loadKeys: function(vnode, done) {
            hitLoad = true;
            done(null, []);
        }
    };

    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err) {
        assert.ifErr(err);
        assert.ok(hitLoad);
        cache.addKey('V', 'K', function(err) {
            assert.ok(err);
            assert.ok(hitAdd);
            hitAdd = false;
            cache.addKey('V', 'K', function(err) {
                assert.ok(err);
                assert.ok(hitAdd);
                assert.end();
            });
        });
    });
});


test('CacheStore.removeKey ignores cache if not loaded', function(assert) {
    var hit;
    var store = {
        removeKey: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        }
    };

    var cache = new CacheStore(store);
    cache.removeKey('V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(hit);
        hit = false;
        cache.removeKey('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            assert.end();
        });
    });
});

test('CacheStore.removeKey uses cache if loaded', function(assert) {
    var hit;
    var store = {
        removeKey: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        },
        loadKeys: function(vnode, done) {
            done(null, ['K']);
        }
    };

    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err) {
        assert.ifErr(err);
        cache.removeKey('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            hit = false;
            cache.removeKey('V', 'K', function(err) {
                assert.ifErr(err);
                assert.notOk(hit);
                assert.end();
            });
        });
    });
});

test('CacheStore.removeKey does not cache if err', function(assert) {
    var hit;
    var store = {
        removeKey: function(vnode, key, done) {
            hit = true;
            done(new Error());
        },
        loadKeys: function(vnode, done) {
            done(null, ['K']);
        }
    };

    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err) {
        assert.ifErr(err);
        cache.removeKey('V', 'K', function(err) {
            assert.ok(err);
            assert.ok(hit);
            hit = false;
            cache.removeKey('V', 'K', function(err) {
                assert.ok(err);
                assert.ok(hit);
                assert.end();
            });
        });
    });
});

test('CacheStore.loadKeys uses cache if already loaded', function(assert) {
    var hit;
    var store = {
        loadKeys: function(vnode, done) {
            hit = true;
            done(null, ['K']);
        }
    };
    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err, keys) {
        assert.ifErr(err);
        assert.ok(hit);
        assert.deepEqual(keys, ['K']);
        hit = false;
        cache.loadKeys('V', function(err, keys) {
            assert.ifErr(err);
            assert.notOk(hit);
            assert.deepEqual(keys, ['K']);
            assert.end();
        });
    });
});

test('CacheStore.loadKeys does not cache if err', function(assert) {
    var hit;
    var store = {
        loadKeys: function(vnode, done) {
            hit = true;
            done(new Error());
        }
    };
    var cache = new CacheStore(store);
    cache.loadKeys('V', function(err) {
        assert.ok(err);
        assert.ok(hit);
        hit = false;
        cache.loadKeys('V', function(err) {
            assert.ok(err);
            assert.ok(hit);
            assert.end();
        });
    });
});
