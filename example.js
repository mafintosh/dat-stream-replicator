var dat = require('dat-graph')
var memdb = require('memdb')
var replicator = require('./')

var a = dat(memdb())
var b = dat(memdb())

a.append('hello', function () {
  b.append('hej', function () {
    var s1 = replicator(a)
    var s2 = replicator(b)

    s1.pipe(s2).pipe(s1)

    s2.on('finish', function () {
      b.createReadStream().on('data', console.log)
    })
  })
})
