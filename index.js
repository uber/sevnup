var VNodeStore = require('./lib/vnode-store.js');
//TODO (joseph@): Config.
var TOTAL_VNODES = 14;

function Sevnup(loadVNKeysFromStorage, persistKeyToVNode, persistRemoveKeyFromVNode) {
    var allVNodes = [];
    for (var i=0; i<TOTAL_VNODES; i++) {
        allVNodes.append(i);
    }
    this.allVNodes = allVNodes;
    this.vnodeStore = new VNodeStore(loadVNKeysFromStorage, persistKeyToVNode, persistRemoveKeyFromVNode);
}

Sevnup.prototype.loadAllKeys = function loadAllKeys() {
    var self = this;
    var vnodes = self.allVNodes;
    for (var i=0; i < vnodes.length; i++) {
        if (self.iOwnVNode(vnodes[i])) {
            self.vnodeStore.loadVNodeKeys(vnodes[i]);
        }
    }
};

/**
 * Takes a hashRing and subscribes to the correct events to maintain VNode
 * ownership.
 * @param {object} hashRing A ringPop implementation of a hashring.
 */
Sevnup.prototype.attachToRing = function attachToRing(hashRing) {
    this.hashRing = hashRing;
    //TODO (joseph@): Listen to proper event.  Test.
    hashRing.on('ringStateChange', this.loadAllKeys);
};

/**
 * Returns true if this node currently owns vnode.
 * @param {string} vnodeName The name of the vnode to check.
 */
Sevnup.prototype.iOwnVNode = function iOwnVNode(vnodeName) {
    vnodeName = vnodeName;
    //TODO (joseph@): Use this.hashRing to check if it owns the node.
};

module.exports = Sevnup;
