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
        var s1 = replicator(graph1)
        var s2 = replicator(graph2)

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
            t.end()
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('replicates when in sync', function (t) {
  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph2.append('hello', function () {
      var s1 = replicator(graph1)
      var s2 = replicator(graph2)

      s2.on('finish', function () {
        collect(graph2.createReadStream(), function (err, datas) {
          t.error(err, 'no error')
          t.same(datas.map(toValue).sort(), ['hello'])
          t.end()
        })
      })

      s1.pipe(s2).pipe(s1)
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
        var s1 = replicator(graph1)
        var s2 = replicator(graph2)

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.on('finish', function () {
          collect(graph1.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('replicates both ways no gzip', function (t) {
  t.plan(4)

  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph2.append('world', function () {
        var s1 = replicator(graph1, {gzip: false})
        var s2 = replicator(graph2, {gzip: false})

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.on('finish', function () {
          collect(graph1.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('one side pushes', function (t) {
  t.plan(4)

  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph2.append('world', function () {
        var s1 = replicator(graph1)
        var s2 = replicator.push(graph2)

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['world'])
          })
        })

        s1.on('finish', function () {
          collect(graph1.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('one side pulls', function (t) {
  t.plan(4)

  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph2.append('world', function () {
        var s1 = replicator(graph1)
        var s2 = replicator.pull(graph2)

        s2.on('finish', function () {
          collect(graph2.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'world', 'worldy'])
          })
        })

        s1.on('finish', function () {
          collect(graph1.createReadStream(), function (err, datas) {
            t.error(err, 'no error')
            t.same(datas.map(toValue).sort(), ['hello', 'worldy'])
          })
        })

        s1.pipe(s2).pipe(s1)
      })
    })
  })
})

tape('both only pulls', function (t) {
  t.plan(2)

  var graph1 = newDat()
  var graph2 = newDat()

  var s1 = replicator.pull(graph1)
  var s2 = replicator.pull(graph2)

  s1.on('error', function () {
    t.ok(true, 'had error')
  })

  s2.on('error', function () {
    t.ok(true, 'had error')
  })

  s2.pipe(s1).pipe(s2)
})

tape('progress', function (t) {
  t.plan(10)

  var graph1 = newDat()
  var graph2 = newDat()

  graph1.append('hello', function () {
    graph1.append('worldy', function () {
      graph2.append('world', function () {
        var s1 = replicator(graph1)
        var s2 = replicator(graph2)

        var expectedPushes = 2
        var pushCount = 0
        var expectedPulls = 1
        var pullCount = 0

        s1.on('push', function (pushed) {
          t.same(pushed.transferred, pushCount++)
          t.same(pushed.length, expectedPushes)
        })

        s1.on('pull', function (pulled) {
          t.same(pulled.transferred, pullCount++)
          t.same(pulled.length, expectedPulls)
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
