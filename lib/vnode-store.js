
/**
 * Creates a new VNodeStore object, optionally taking in the persistence hooks
 * needed to save and restore the in-memory vnode set from an external data
 * source.
 * @constructor
 * @param {function} loadVNodeKeySetsFromStore The function that will return
 *    a set, keyed by VNode name, with a list or set of keys. Usually sourced
 *    by the datastore.
 * @param {function} persistKeyToVNode The function that will take a VNode and
 *    a new key and will save the new key out to the datastore.  
 * @param {function} persistRemoveKeyFromVNode The inverse of
 *    persistKeyToVNode, this will remove a key from a VNode's set in the
 *    store.
 */
function VNodeStore(loadVNodeKeySetsFromStore, persistKeyToVNode, persistRemoveKeyFromVNode) {
    this.vnCache = {};
    this.loadVNodeKeySetsFromStore = loadVNodeKeySetsFromStore;
    this.persistKeyToVNode = persistKeyToVNode;
    this.persistRemoveKeyFromVNode = persistRemoveKeyFromVNode;
}

/**
 * Adds a key stewardship to a VNode.  If the cache doesn't currently know
 * about the VNode, it adds it.
 * @param {string} vnodeName The name of the virtual node to own the key.
 * @param {string} key The key to be watched by the vnode.
 */
VNodeStore.prototype.addKeyToVNode = function addKeyToVNode(vnodeName, key) {
    var self = this;
    var vnCache = self.vnCache;
    if(!self._objectContainsKey(vnCache, vnodeName)) {
        vnCache[vnodeName] = {};
    }
    if(self._objectContainsKey(vnCache[vnodeName], key) ) {
        if(typeof self.persistKeyToVNode === 'function') {
            self.persistKeyToVNode(vnodeName, key);
        }
        vnCache[vnodeName][key] = true;
    }
};


/**
 * Removes a key from a VNode's watch, if it exists in the first place.  If
 * a delete operation is actually performed, the persistence callback is
 * triggered.
 * @param {string} vnodeName The name of the vnode to disown the key.
 * @param {string} key The key to be disowned.
 */
VNodeStore.prototype.removeKeyFromVNode = function removeKeyFromVNode(vnodeName, key) {
    var self = this;
    if(self._objectContainsKey(self.vnCache, vnodeName) &&
            self._objectContainsKey(self.vnCache[vnodeName], key)) {
        if(typeof self.persistRemoveKeyFromVNode === 'function') {
            self.persistRemoveKeyFromVNode(vnodeName, key);
        }
        delete self.vnCache[vnodeName][key];
    }
};

/**
 * Uses the parameter vnodeKeySets if exists to set the vnode cache to  a Map where
 * the key is a VNode name and the value is a set of keys. If the parameter is
 * not passed, it checks for the overriden method loadVNodeKeySetsFromStore to
 * return the same Map from whatever source the client desires.  If neither can
 * provide such a Map, it defaults to setting the cache to an empty object, if
 * none exist.
 * @param {string} vnodeKeySets A map where the key is the vnode name and the
 *    value is a set of keys.  Used to override the normal method of fetching.
 */
VNodeStore.prototype.loadVNodeKeySets = function loadVNodeKeySets(vnodeKeySets) {
    if(!typeof vnodeKeySets === 'object') {
        vnodeKeySets = this.loadVNodeKeySetsFromStore();
    }
    if(!vnodeKeySets) {
       vnodeKeySets = {};
    }
    this.vnCache = vnodeKeySets;
}

/**
 * A helper method to check if the object/map has the key requested, without
 * getting an accidental hit on an Object base property or method.  If it ends
 * up being used elsewhere in the code, should probably move to a helper file,
 * but currently it's assigned to this class to avoid the function being
 * garbage collected.
 * @param {object} object Any object, to be checked for the peresence of key.
 * @param {string} key Any string, checks to see if the object contains that
 *    that property.
 */
VNodeStore.prototype._objectContainsKey = function _objectContainsKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

module.exports = VNodeStore;
