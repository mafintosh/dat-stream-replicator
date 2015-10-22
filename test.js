var tape = require('tape')
var dat = require('dat-graph')
var memdb = require('memdb')
var collect = require('stream-collector')

var replicator = require('./')

tape('replicates', function (t) {
  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph1.append('world', function () {
        var s1 = replicator(graph1, 's1')
        var s2 = replicator(graph2, 's2')

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue), ['hello', 'worldy', 'world'])
            t.end()
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('replicates both ways', function (t) {
  t.plan(4)

  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph2.append('world', function () {
        var s1 = replicator(graph1, 's1')
        var s2 = replicator(graph2, 's2')

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue), ['world', 'hello', 'worldy'])
          })
        })

        s1.on('finish', function () {
          collect(graph1.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue), ['hello', 'world', 'worldy'])
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

function newDat () {
  return dat(memdb())
}

function toValue (data) {
  return data.value.toString()
}
