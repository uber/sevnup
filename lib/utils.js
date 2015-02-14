function inANotB(arrayA, arrayB) {
    return arrayA.filter(function(i) {return arrayB.indexOf(i) < 0;});
}

function inHashANotB(hashA, hashB) {
    var results = [];
    for (var key in hashA) {
        if (hashA.hasOwnProperty(key) && !hashB[key]) {
            results.push(key);
        }
    }
    return results;
}

module.exports = {
    'inANotB': inANotB,
    'inHashANotB': inHashANotB
};
