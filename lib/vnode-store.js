
/**
 * Creates a new VNodeStore object, optionally taking in the persistence hooks
 * needed to save and restore the in-memory vnode set from an external data
 * source.
 * @constructor
 * @param {function} loadVNodeKeyArrayFromStore The function that will return
 *    a set, keyed by VNode name, with a list or set of keys. Usually sourced
 *    by the datastore.
 * @param {function} persistKeyToVNode The function that will take a VNode and
 *    a new key and will save the new key out to the datastore.  
 * @param {function} persistRemoveKeyFromVNode The inverse of
 *    persistKeyToVNode, this will remove a key from a VNode's set in the
 *    store.
 */
function VNodeStore(loadVNodeKeyArrayFromStore, persistKeyToVNode, persistRemoveKeyFromVNode) {
    this.vnCache = {};
    this.loadVNodeKeyArrayFromStore = loadVNodeKeyArrayFromStore;
    this.persistKeyToVNode = persistKeyToVNode;
    this.persistRemoveKeyFromVNode = persistRemoveKeyFromVNode;
}

/**
 * Adds key stewardship to a VNode.  If the cache doesn't currently know
 * about the VNode, it adds it. 
 * TODO(joseph@): Think about whether we should catch persistence exceptions.
 * @param {string} vnodeName The name of the virtual node to own the key.
 * @param {string} key The key to be watched by the vnode.
 */
VNodeStore.prototype.addKeyToVNode = function addKeyToVNode(vnodeName, key) {
    var self = this;
    var vnCache = self.vnCache;
    if (!self._objectContainsKey(vnCache, vnodeName)) {
        vnCache[vnodeName] = {};
    }
    if (!self._objectContainsKey(vnCache[vnodeName], key) ) {
        if (typeof self.persistKeyToVNode === 'function') {
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
    if (self._objectContainsKey(self.vnCache, vnodeName) &&
            self._objectContainsKey(self.vnCache[vnodeName], key)) {
        if (typeof self.persistRemoveKeyFromVNode === 'function') {
            self.persistRemoveKeyFromVNode(vnodeName, key);
        }
        delete self.vnCache[vnodeName][key];
    }
};

/**
 * Uses the parameter vnodeKeyArray if exists to set the vnode cache to a Map where
 * the key is a VNode name and the value is a set of keys. If the parameter is
 * not passed, it checks for the overriden method loadVNodeKeysFromStorage to
 * return the same Map from whatever source the client desires.  If neither can
 * provide such a Map, it defaults to setting the cache to an empty object, if
 * none exist.
 * @param {string} vnodeKeyArray An array of keys that belong to the set, can be
 *     used to override any loaded from the datastore.
 */
VNodeStore.prototype.loadVNodeKeys = function loadVNodeKeys(vnodeName, vnodeKeyArray) {
    if (typeof vnodeKeyArray !== 'object' && 
            typeof this.loadVNodeKeysFromStorage === 'function') {
        vnodeKeyArray = this.loadVNodeKeysFromStorage(vnodeName);
        console.log(JSON.stringify(vnodeKeyArray));
    }
    if (!vnodeKeyArray) {
       vnodeKeyArray = [];
    }
    var vnSet = this._arrayToSet(vnodeKeyArray);
    // TODO (joseph@): Consider joining instead of overwriting. Any bugs?
    this.vnCache[vnodeName] = vnSet;
};

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
};

/**
 * A helper method to turn an array, which will often be returned from the
 * datastore callbacks, to a set, which is more optimal for searching.
 * @param {object} array A list of items to be added to the set as keys.
 */
VNodeStore.prototype._arrayToSet = function _arrayToSet(array) {
    var set = {};
    for (var i=0; i < array.length; i++) {
        set[array[i]] = true;
    }
    return set;
};

module.exports = VNodeStore;
