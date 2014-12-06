var test = require('tape');

var Sevnup = require('../index.js');

function mockSevnup() {
    var sevnup = new Sevnup(14);
    return sevnup;
}

test('loadAllKeys: successfully restore all vnodes it owns and only what it owns', function (assert) {
    var sevnup = mockSevnup();
    sevnup.counter = 0;
    sevnup.iOwnVNode = function (vnode) {
        assert.ok(vnode !== undefined);
        console.log('tvv ' + vnode);
        return sevnup.counter++ % 2; 
    };

    sevnup.vnodeStore = {};
    sevnup.vnodeStore.loadVNodeKeys = function (vnode) {
        assert.ok(parseInt(vnode) % 2);
    };
    sevnup.loadAllKeys();
    assert.end();
});

test('attachToRing: ensure the hashring lookup takes ownership of owned keys', function (assert) {
    var me = 22;
    var sevnup = mockSevnup();
    var hashRing = {};
    hashRing.on = function(eventName, cb) {
        assert.ok(eventName);
        assert.ok(cb);
    };
    hashRing.whoami = function () {
        return me;
    };
    sevnup.addKeyToVNode = function (vnode, key) {
        assert.ok(key % 2);    
    };

    hashRing.lookup = function(key) {
        assert.ok(key !== undefined);
        return me;
    };

    sevnup.attachToRing(hashRing);
    hashRing.lookup(55);
    assert.end();
});
