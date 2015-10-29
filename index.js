var lpstream = require('length-prefixed-stream')
var multiplex = require('multiplex')
var protobuf = require('protocol-buffers')
var collect = require('stream-collector')
var crypto = require('crypto')
var varint = require('varint')
var pump = require('pump')
var zlib = require('zlib')

var messages = protobuf(
  'message Handshake {' +
  '  optional string mode = 1;' +
  '  optional uint64 nodes = 2;' +
  '  required bytes hash = 3;' +
  '  optional bool gzip = 4;' +
  '}'
)

replicator.pull = function (dat, opts) {
  if (!opts) opts = {}
  opts.mode = 'pull'
  return replicator(dat, opts)
}

replicator.push = function (dat, opts) {
  if (!opts) opts = {}
  opts.mode = 'push'
  return replicator(dat, opts)
}

module.exports = replicator

function replicator (dat, opts) {
  if (!opts) opts = {}

  var plex = multiplex(onstream)
  var mode = opts.mode || (opts.readonly ? 'push' : (opts.writeonly ? 'pull' : 'sync'))
  var gzip = opts.gzip !== false
  var pushed = plex.pushed = {transferred: 0, length: 0}
  var pulled = plex.pulled = {transferred: 0, length: 0}

  var local = plex.createStream('info')
  var remote = plex.receiveStream('info')
  var remoteMode
  var handshake
  var remoteHandshake
  var missing = 2
  var corked = false

  dat.count(function (err, count) {
    if (err) return plex.destroy(err)
    dat.heads(function (err, heads) {
      if (err) return plex.destroy(err)
      ready(count, hashNodes(heads))
    })
  })

  plex.on('prefinish', function () {
    if (!missing) return
    corked = true
    plex.cork()
  })

  return plex

  function ready (count, hash) {
    if (plex.destroyed) return
    handshake = {mode: mode, nodes: count, hash: hash, gzip: gzip}
    local.write(messages.Handshake.encode(handshake))
    remote.once('data', function (data) {
      remoteHandshake = messages.Handshake.decode(data)
      remoteMode = remoteHandshake.mode
      if (!remoteHandshake.gzip) gzip = false

      if (remoteMode === 'pull' && mode === 'pull') return plex.destroy(new Error('One side has to push'))
      if (remoteMode === 'push' && mode === 'push') return plex.destroy(new Error('One side has to pull'))
      if (mode !== 'sync' || remoteMode !== 'sync') missing--

      var cmp = compare(handshake, remoteHandshake)
      if (cmp === 0) onend()
      else if (cmp < 0) onactive()
      else onpassive()
    })
  }

  function onactive () {
    var stream = plex.createStream('diff')
    var diff = dat.createDiffStream({binary: true})

    pump(diff, stream, diff, onerror)
    diff.on('end', function () {
      for (var i = 0; i < diff.since.length; i++) local.write(diff.since[i])
      local.end()
      onsince(diff.since)
    })
  }

  function onpassive () {
    collect(remote, function (err, since) {
      if (err) return plex.destroy(err)
      onsince(since)
    })
  }

  function onsince (since) {
    if (mode === 'pull' || remoteMode === 'push') return

    var rs = dat.createReadStream({since: since, binary: true})
    rs.on('error', onerror)
    rs.once('ready', function () {
      rs.removeListener('error', onerror)
      var nodes = createWriteStream(gzip, plex.createStream('nodes'), ondone)
      pushed.length = rs.length
      plex.emit('push', pushed)
      nodes.write(varint.encode(rs.length, new Buffer(varint.encodingLength(rs.length))))
      pump(rs, nodes, onerror)
      rs.on('data', onpush)
    })
  }

  function onstream (stream, id) {
    if (id === 'diff') onreceivediff(stream)
    else if (id === 'nodes') onnodes(createReadStream(gzip, stream, onerror))
    else stream.destroy()
  }

  function onreceivediff (stream) {
    var match = dat.createMatchStream({binary: true})
    stream.halfOpen = true
    pump(stream, match, stream, onerror)
  }

  function onnodes (stream) {
    stream.on('error', onerror)
    stream.once('data', function (data) {
      stream.removeListener('error', onerror)
      var length = pulled.length = varint.decode(data)
      plex.emit('pull', pulled)
      if (!length) return ondone()
      pump(stream, dat.createWriteStream({binary: true}), ondone)
      stream.on('data', onpull)
    })
  }

  function onend () {
    missing = 0
    if (corked) plex.uncork()
    plex.finalize()
  }

  function onpush () {
    pushed.transferred++
    plex.emit('push', pushed)
  }

  function onpull () {
    pulled.transferred++
    plex.emit('pull', pulled)
  }

  function ondone (err) {
    if (err) return onerror(err)
    if (!--missing) onend()
  }

  function onerror (err) {
    if (err) plex.destroy(err)
  }
}

function createWriteStream (gzip, nodes, onfinish) {
  if (!gzip) return nodes.on('finish', onfinish)
  var enc = lpstream.encode()
  var zip = zlib.createGzip()
  pump(enc, zip, nodes, onfinish)
  return enc
}

function createReadStream (gzip, nodes, onerror) {
  if (!gzip) return nodes
  var unzip = zlib.createGunzip()
  var dec = lpstream.decode()
  nodes.chunked = true
  pump(nodes, unzip, dec, onerror)
  return dec
}

function compare (handshake, remoteHandshake) {
  if (handshake.nodes !== remoteHandshake.nodes) return handshake.nodes - remoteHandshake.nodes
  return bufferCompare(handshake.hash, remoteHandshake.hash)
}

function bufferCompare (a, b) {
  var min = Math.min(a.length, b.length)
  for (var i = 0; i < min; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

function hashNodes (list) { // TODO: use framed-hash for consistency instead?
  var hash = crypto.createHash('sha256')
  for (var i = 0; i < list.length; i++) hash.update(list[i].key)
  return hash.digest()
}
