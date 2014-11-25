var VNodeStore = require('./lib/vnode-store.js');

function Sevnup(hashRing, loadVNKeysFromStorage, persistKeyToVNode, persistRemoveKeyFromVNode) {
    //TODO (joseph@): add hashring attach if exists.
    //TODO (joseph@): add 'recover' method override, make sure hooks in
    //    VNodeStore.
    this.vnodeStore = new VNodeStore(loadVNKeysFromStorage, persistKeyToVNode, persistRemoveKeyFromVNode);
}

Sevnup.prototype.loadAllKeys = function loadAllKeys() {
    var self = this;
    var vnodes = [1,2,3,4,5];
    for (var i=0; i < vnodes.length; i++) {
        if (self.iOwnVnode(vnodes[i])) {
            self.vnodeStore.loadVNodeKeys(vnodes[i]);
        }
    }
    // TODO (joseph@): for key in vnodeStore, do operation.  if return false,
    //     delete key.
    
};

module.exports = Sevnup;
