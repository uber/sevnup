var test = require('tape');

var sevnup = require('../index.js');

test('sevnup is a function', function (assert) {
    assert.strictEqual(typeof sevnup, 'function');
    assert.end();
});
