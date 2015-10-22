var multiplex = require('multiplex')
var varint = require('varint')
var collect = require('stream-collector')
var pump = require('pump')

module.exports = replicator

replicator.pull = function (dag) {
  return replicator(dag, {mode: 'pull'})
}

replicator.push = function (dag) {
  return replicator(dag, {mode: 'push'})
}

function replicator (dag, opts) {
  if (!opts) opts = {}

  var missing = 2
  var corked = false

  var plex = multiplex(function (stream) {
    stream.destroy() // destroy any unwanted stream
  })

  var pull = plex.pulled = {transferred: 0, length: 0}
  var push = plex.pushed = {transferred: 0, length: 0}

  var nodes = plex.receiveStream('nodes', {halfOpen: true})
  collect(nodes, function (err, since) {
    if (err) return plex.destroy(err)
    var rs = dag.createReadStream({since: since, binary: true})
    rs.on('error', onerror)
    rs.on('ready', function () {
      nodes.write(varint.encode(rs.length, new Buffer(varint.encodingLength(rs.length))))
      onpushstart(rs.length)
      rs.on('data', onpush)
      pump(rs, nodes, onpumped)
    })
  })

  var match = dag.createMatchStream({binary: true})
  var diff = dag.createDiffStream({binary: true})

  plex.receiveStream('diff').pipe(match).pipe(plex.createStream('match'))
  plex.receiveStream('match').pipe(diff).pipe(plex.createStream('diff'))

  match.on('error', onerror)
  diff.on('error', onerror)

  diff.on('end', function () {
    var nodes = plex.createStream('nodes', {halfOpen: true})
    for (var i = 0; i < diff.since.length; i++) nodes.write(diff.since[i])
    nodes.end()
    nodes.once('data', function (data) {
      var ws = dag.createWriteStream({binary: true})
      onpullstart(varint.decode(data))
      nodes.on('data', onpull)
      pump(nodes, ws, onpumped)
    })
  })

  plex.on('prefinish', function () {
    if (!missing) return
    corked = true
    plex.cork()
  })

  return plex

  function onpumped (err) {
    if (err) return onerror(err)
    ondone()
  }

  function ondone () {
    if (--missing) return
    if (corked) plex.uncork()
    plex.finalize()
  }

  function onpushstart (length) {
    push.length = length
    plex.emit('push', push)
  }

  function onpush () {
    push.transferred++
    plex.emit('push', push)
  }

  function onpullstart (length) {
    pull.length = length
    plex.emit('pull', pull)
  }

  function onpull () {
    pull.transferred++
    plex.emit('pull', pull)
  }

  function onerror (err) {
    plex.destroy(err)
  }
}
