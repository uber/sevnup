var test = require('tape');

var VNodeStore = require('../../lib/vnode-store.js');

var TEST_VNODE_NAME = 'vnode';
var TEST_VNODE_KEY = 'key';
var TEST_VNODE_CACHE = {};
TEST_VNODE_CACHE[TEST_VNODE_NAME] = {};
TEST_VNODE_CACHE[TEST_VNODE_NAME][TEST_VNODE_KEY] = true;

function setUpVNodeStoreWithKeys(vnodeName, testKey) {
    var vnodeStore = new VNodeStore();
    vnodeName = vnodeName || TEST_VNODE_NAME;
    testKey = testKey || TEST_VNODE_KEY;
    vnodeStore.persistKeyToVNode = function(vnode, key, callback) {
        callback();
    };
    vnodeStore.persistRemoveKeyFromVNode = function(vnode, key, callback) {
        callback();
    };

    vnodeStore.getVNodeKeysFromStorage = function(vnode, callback) {
        callback([testKey]);
    };
    vnodeStore.vnCache[vnodeName] = {};
    vnodeStore.vnCache[vnodeName][testKey] = true;
    return vnodeStore;
}

test('addKeyToVNode: does not change vnode state when persist fails', function (assert) {
   var vnodeStore = new VNodeStore(); 
   vnodeStore.persistKeyToVNode = function() {
      throw new Error();    
   };
   try{
      vnodeStore.addKeyToVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
   } catch (e) {} finally {
      assert.notOk(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY]);
      assert.end();
   }
});

test('addKeyToVNode: creates vnode in map automatically when first key from vnode', function (assert) {
    var vnodeStore = setUpVNodeStoreWithKeys();
    delete vnodeStore.vnCache[TEST_VNODE_NAME];
    assert.notOk(vnodeStore.vnCache[TEST_VNODE_NAME]);
    vnodeStore.addKeyToVNode(TEST_VNODE_NAME, TEST_VNODE_KEY, function(err) {
        assert.notOk(err);
        assert.ok(vnodeStore.vnCache[TEST_VNODE_NAME]);
        assert.end();
    });
});

test('addKeyToVNode: persists via callback after changing vnode state', function (assert) {
    var vnodeStore = new VNodeStore();
    var vnodeToPersist = TEST_VNODE_NAME;
    var keyToPersist = TEST_VNODE_KEY;
    var functionHit = false;
    vnodeStore.persistKeyToVNode = function(vnodeName, key) {
        assert.equal(vnodeName, vnodeToPersist);
        assert.equal(key, keyToPersist);
        functionHit = !functionHit;
    };
    vnodeStore.addKeyToVNode(vnodeToPersist, keyToPersist);
    assert.ok(functionHit, 'persistence function hit after state change');
    assert.end();
});

test('addKeyToVNode: do not persist when no change in state', function (assert) {
    var vnodeStore = setUpVNodeStoreWithKeys();
    var vnodeToPersist = TEST_VNODE_NAME;
    var keyToPersist = TEST_VNODE_KEY;
    var callCount = 0;
    delete vnodeStore.vnCache[vnodeToPersist];
    vnodeStore.persistKeyToVNode = function(vnodeName, key, callback) {
        assert.equal(vnodeName, vnodeToPersist);
        assert.equal(key, keyToPersist);
        callCount++;
        callback();
    };
    vnodeStore.addKeyToVNode(vnodeToPersist, keyToPersist, function(err) {
        assert.notOk(err);
        assert.equal(callCount, 1, 'persisted once');
        vnodeStore.addKeyToVNode(vnodeToPersist, keyToPersist, function(err) {
            assert.notOk(err);
            assert.equal(callCount, 1, 'still only persisted once');
            assert.end();
        });
    });
});

test('removeKeyFromVNode: does not change vnode state when persist fails', function (assert) {
   var vnodeStore = setUpVNodeStoreWithKeys(TEST_VNODE_NAME, TEST_VNODE_KEY);
   vnodeStore.persistRemoveKeyFromVNode = function() {
      throw new Error();    
   };
   try{
      vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
   } catch (e) {} finally {
      assert.ok(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY], 'key should still be here if persist failed');
      assert.end();
   }
});

test('removeKeyFromVNode: removes key from vnode', function (assert) {
    var vnodeStore = setUpVNodeStoreWithKeys(TEST_VNODE_NAME);
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY, function(err) {
        assert.notOk(err);
        assert.notOk(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY]);
        assert.end();
    });
});

test('removeKeyFromVNode: persists via callback after changing vnode state', function (assert) {
    var vnodeStore = setUpVNodeStoreWithKeys(TEST_VNODE_NAME, TEST_VNODE_KEY);
    var functionHit = false;
    vnodeStore.persistRemoveKeyFromVNode = function(vnodeName, key) {
        assert.equal(vnodeName, TEST_VNODE_NAME);
        assert.equal(key, TEST_VNODE_KEY);
        functionHit = !functionHit;
    };
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
    assert.ok(functionHit, 'persistence function hit after state change');
    assert.end();
});

test('removeKeyFromVNode: do not persist when no change in state', function (assert) {
    var vnodeStore = setUpVNodeStoreWithKeys();
    var callCount = 0;
    vnodeStore.persistRemoveKeyFromVNode = function(vnodeName, key, callback) {
        assert.equal(vnodeName, TEST_VNODE_NAME, 'removing from proper vnode');
        assert.equal(key, TEST_VNODE_KEY, 'removing proper key');
        callCount++;
        callback();
    };
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY, function(err) {
        assert.notOk(err);
        assert.equal(callCount, 1, 'persisted once');
        vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY, function(err) {
            assert.notOk(err);
            assert.equal(callCount, 1, 'still only persisted once');
            assert.end();
        });
    });

});

test('loadVNodeKeys: vnCache is loaded properly from datastore override', function (assert) {
    var vnodeStore = new VNodeStore();
    vnodeStore.loadVNodeKeysFromStorage = function (vnode, callback) {
        callback(undefined, [TEST_VNODE_KEY]);
    };
    vnodeStore.loadVNodeKeys(TEST_VNODE_NAME, function done() {
        assert.equal(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY],
            TEST_VNODE_CACHE[TEST_VNODE_NAME][TEST_VNODE_KEY]);
        assert.end();
    });
});

test('loadVNodeKeys: vnCache defaults to an empty object when no other sources are provided', 
        function (assert) {
    var vnodeStore = new VNodeStore();
    vnodeStore.loadVNodeKeysFromStorage = function(vnode, callback) {
       callback();
    };
    vnodeStore.loadVNodeKeys(TEST_VNODE_NAME, function done() {
        assert.ok(vnodeStore.vnCache, 'vnCache exists');
        assert.notOk(vnodeStore.vnCache[TEST_VNODE_KEY]);
        assert.end();
        });
    });

//TODO(joseph@): Write test for both forEachKey false 

//TODO(joseph@): Write test for forEachKey true


test('_objectContainsKey: finds attribute in object when present', function (assert) {
    var vnodeStore = new VNodeStore();
    var obj = {'a': true};
    assert.ok(vnodeStore._objectContainsKey(obj, 'a'));
    assert.end();
});

test('_objectContainsKey: fails to find attribute in object when not present', function (assert) {
    var vnodeStore = new VNodeStore();
    var obj = {'a': true};
    assert.notOk(vnodeStore._objectContainsKey(obj, 'b'));
    assert.end();
});

test('_arrayToSet: changes an array into a hashMap with value true for each key', function (assert) {
    var arr = ['a', 'b'];
    var set = (new VNodeStore())._arrayToSet(arr);
    assert.ok(set.a);
    assert.ok(set.b);
    assert.notOk(set.c);
    assert.end();
});
