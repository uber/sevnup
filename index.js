var VNodeStore = require('./lib/vnode-store.js');

function Sevnup(hashRing, loadVNodeKeySetsFromDataStore, persistKeyToVNode, persistRemoveKeyFromVNode) {
    //TODO (joseph@): add hashring attach if exists.
    //TODO (joseph@): add 'recover' method override, make sure hooks in
    //    VNodeStore.
    this.vnodeStore = new VNodeStore(loadVNodeKeySetsFromDataStore, persistKeyToVNode, persistRemoveKeyFromVNode);
}

Sevnup.prototype.loadAllKeys = function loadAllKeys() {
    var self = this;
    self.vnodeStore.loadVNodeKeySets();
    // TODO (joseph@): for key in vnodeStore, do operation.  if return false,
    //     delete key.
    
};

module.exports = Sevnup;
