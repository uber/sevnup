var test = require('tape');

var VNodeStore = require('../../lib/vnode-store.js');

var TEST_VNODE_NAME = 'vnode';
var TEST_VNODE_KEY = 'key';
var TEST_VNODE_CACHE = {};
TEST_VNODE_CACHE[TEST_VNODE_NAME] = {};
TEST_VNODE_CACHE[TEST_VNODE_NAME][TEST_VNODE_KEY] = true;

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
    var vnodeStore = new VNodeStore();
    assert.notOk(vnodeStore.vnCache[TEST_VNODE_NAME]);
    vnodeStore.addKeyToVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
    assert.ok(vnodeStore.vnCache[TEST_VNODE_NAME]);
    assert.end();
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
    var vnodeStore = new VNodeStore();
    var vnodeToPersist = TEST_VNODE_NAME;
    var keyToPersist = TEST_VNODE_KEY;
    var callCount = 0;
    vnodeStore.persistKeyToVNode = function(vnodeName, key) {
        assert.equal(vnodeName, vnodeToPersist);
        assert.equal(key, keyToPersist);
        callCount++;
    };
    vnodeStore.addKeyToVNode(vnodeToPersist, keyToPersist);
    assert.equal(callCount, 1, 'persisted once');
    vnodeStore.addKeyToVNode(vnodeToPersist, keyToPersist);
    assert.equal(callCount, 1, 'still only persisted once');
    assert.end();
});

function setUpVNodeStoreWithKeys(vnodeName, key) {
    var vnodeStore = new VNodeStore();
    vnodeStore.persistAddKeyToVNode = function() {};
    vnodeStore.addKeyToVNode(vnodeName, key);
    return vnodeStore;
}

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
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
    assert.notOk(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY]);
    assert.end();
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
    var vnodeStore = setUpVNodeStoreWithKeys(TEST_VNODE_NAME, TEST_VNODE_KEY);
    var callCount = 0;
    vnodeStore.persistRemoveKeyFromVNode = function(vnodeName, key) {
        assert.equal(vnodeName, TEST_VNODE_NAME);
        assert.equal(key, TEST_VNODE_KEY);
        callCount++;
    };
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
    assert.equal(callCount, 1, 'persisted once');
    vnodeStore.removeKeyFromVNode(TEST_VNODE_NAME, TEST_VNODE_KEY);
    assert.equal(callCount, 1, 'still only persisted once');
    assert.end();
});

test('loadVNodeKeySets: vnCache is set by vnodeKeySet param override', function (assert) {
    var vnodeStore = new VNodeStore();  
    vnodeStore.loadVNodeKeySets(TEST_VNODE_CACHE);
    assert.equal(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY], 
        TEST_VNODE_CACHE[TEST_VNODE_NAME][TEST_VNODE_KEY]);
    assert.end();
});

test('loadVNodeKeySets: vnCache is loaded properly from datastore override', function (assert) {
    var vnodeStore = new VNodeStore();
    vnodeStore.loadVNodeKeySetsFromStore = function () {
        return TEST_VNODE_CACHE;
    };
    vnodeStore.loadVNodeKeySets();
    assert.equal(vnodeStore.vnCache[TEST_VNODE_NAME][TEST_VNODE_KEY], 
        TEST_VNODE_CACHE[TEST_VNODE_NAME][TEST_VNODE_KEY]);
    assert.end();
});

test('loadVNodeKeySets: vnCache defaults to an empty object when no other sources are provided', 
        function (assert) {
    var vnodeStore = new VNodeStore();
    vnodeStore.loadVNodeKeySets();
    assert.ok(vnodeStore.vnCache, 'vnCache exists');
    assert.notOk(vnodeStore.vnCache[TEST_VNODE_KEY]);
    assert.end();
});


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
