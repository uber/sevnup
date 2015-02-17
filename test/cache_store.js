var test = require('tape');

var CacheStore = require('../cache_store');

test('CacheStore.add does not use the cache if it has not been loaded', function(assert) {
    var hit;
    var store = {
        add: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        }
    };

    var cache = new CacheStore(store);
    cache.add('V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(hit);
        hit = false;
        cache.add('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            assert.end();
        });
    });
});

test('CacheStore.add uses the cache if loaded', function(assert) {
    var hitAdd;
    var hitLoad;
    var store = {
        add: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hitAdd = true;
            done();
        },
        load: function(vnode, done) {
            hitLoad = true;
            done(null, []);
        }
    };

    var cache = new CacheStore(store);
    cache.load('V', function(err) {
        assert.ifErr(err);
        assert.ok(hitLoad);
        cache.add('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hitAdd);
            hitAdd = false;
            cache.add('V', 'K', function(err) {
                assert.ifErr(err);
                assert.notOk(hitAdd);
                assert.end();
            });
        });
    });
});

test('CacheStore.add does not cache if error', function(assert) {
    var hitAdd;
    var hitLoad;
    var store = {
        add: function(vnode, key, done) {
            hitAdd = true;
            done(new Error());
        },
        load: function(vnode, done) {
            hitLoad = true;
            done(null, []);
        }
    };

    var cache = new CacheStore(store);
    cache.load('V', function(err) {
        assert.ifErr(err);
        assert.ok(hitLoad);
        cache.add('V', 'K', function(err) {
            assert.ok(err);
            assert.ok(hitAdd);
            hitAdd = false;
            cache.add('V', 'K', function(err) {
                assert.ok(err);
                assert.ok(hitAdd);
                assert.end();
            });
        });
    });
});


test('CacheStore.remove ignores cache if not loaded', function(assert) {
    var hit;
    var store = {
        remove: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        }
    };

    var cache = new CacheStore(store);
    cache.remove('V', 'K', function(err) {
        assert.ifErr(err);
        assert.ok(hit);
        hit = false;
        cache.remove('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            assert.end();
        });
    });
});

test('CacheStore.remove uses cache if loaded', function(assert) {
    var hit;
    var store = {
        remove: function(vnode, key, done) {
            assert.equal(vnode, 'V');
            assert.equal(key, 'K');
            hit = true;
            done();
        },
        load: function(vnode, done) {
            done(null, ['K']);
        }
    };

    var cache = new CacheStore(store);
    cache.load('V', function(err) {
        assert.ifErr(err);
        cache.remove('V', 'K', function(err) {
            assert.ifErr(err);
            assert.ok(hit);
            hit = false;
            cache.remove('V', 'K', function(err) {
                assert.ifErr(err);
                assert.notOk(hit);
                assert.end();
            });
        });
    });
});

test('CacheStore.remove does not cache if err', function(assert) {
    var hit;
    var store = {
        remove: function(vnode, key, done) {
            hit = true;
            done(new Error());
        },
        load: function(vnode, done) {
            done(null, ['K']);
        }
    };

    var cache = new CacheStore(store);
    cache.load('V', function(err) {
        assert.ifErr(err);
        cache.remove('V', 'K', function(err) {
            assert.ok(err);
            assert.ok(hit);
            hit = false;
            cache.remove('V', 'K', function(err) {
                assert.ok(err);
                assert.ok(hit);
                assert.end();
            });
        });
    });
});

test('CacheStore.load uses cache if already loaded', function(assert) {
    var hit;
    var store = {
        load: function(vnode, done) {
            hit = true;
            done(null, ['K']);
        }
    };
    var cache = new CacheStore(store);
    cache.load('V', function(err, keys) {
        assert.ifErr(err);
        assert.ok(hit);
        assert.deepEqual(keys, ['K']);
        hit = false;
        cache.load('V', function(err, keys) {
            assert.ifErr(err);
            assert.notOk(hit);
            assert.deepEqual(keys, ['K']);
            assert.end();
        });
    });
});

test('CacheStore.load does not cache if err', function(assert) {
    var hit;
    var store = {
        load: function(vnode, done) {
            hit = true;
            done(new Error());
        }
    };
    var cache = new CacheStore(store);
    cache.load('V', function(err) {
        assert.ok(err);
        assert.ok(hit);
        hit = false;
        cache.load('V', function(err) {
            assert.ok(err);
            assert.ok(hit);
            assert.end();
        });
    });
});
