var test = require('tape');

var MockStore = require('../mock_store');

test('MockStore flow', function(assert) {
    var store = new MockStore();
    store.remove('V', 'K');
    assert.deepEqual(store.load('V'), []);
    store.add('V', 'K');
    assert.deepEqual(store.load('V'), ['K']);
    store.remove('V', 'K');
    assert.deepEqual(store.load('V'), []);
    assert.end();
});
