module.exports = MockRing;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function MockRing(me) {
    EventEmitter.call(this);
    this.keyMapping = {};
    this.me = me;
}
util.inherits(MockRing, EventEmitter);

MockRing.prototype.ready = function ready() {
    this.emit('ready');
};

MockRing.prototype.changeRing = function changeRing(keyMapping) {
    this.keyMapping = keyMapping;
    this.emit('changed');
};

MockRing.prototype.whoami = function whoami() {
    return this.me;
};

MockRing.prototype.lookup = function lookup(key) {
    return this.keyMapping[key];
};
