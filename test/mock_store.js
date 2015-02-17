var test = require('tape');

var MockStore = require('../mock_store');

test('MockStore flow', function(assert) {
    var store = new MockStore();
    store.removeKey('V', 'K');
    assert.deepEqual(store.loadKeys('V'), []);
    store.addKey('V', 'K');
    assert.deepEqual(store.loadKeys('V'), ['K']);
    store.removeKey('V', 'K');
    assert.deepEqual(store.loadKeys('V'), []);
    assert.end();
});
