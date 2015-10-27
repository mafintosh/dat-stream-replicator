# dat-stream-replicator

Streaming replicator for [dat-graph](https://github.com/mafintosh/dat-graph)

```
npm install dat-stream-replicator
```

[![build status](http://img.shields.io/travis/mafintosh/dat-stream-replicator.svg?style=flat)](http://travis-ci.org/mafintosh/dat-stream-replicator)

## Usage

``` js
var replicator = require('dat-stream-replicator')

var dat = datGraphInstance
var otherDat = anotherDatGraphInstance

var stream = replicator(dat)
var otherStream = replicator(otherDat)

stream.pipe(otherStream).pipe(stream)
```

## API

#### `var stream = replicator(datGraph, [options])`

Create a new replication stream for a [dat-graph](https://github.com/mafintosh/dat-graph) instance.
Options include:

``` js
{
  // gzip the nodes being sent. both sides have to say `true` for gzip to be enabled
  // defaults to true
  gzip: true,
  // only pull/push or do a two way sync. defaults to sync
  mode: 'sync'
}
```

#### `var stream = replicator.pull(datGraph, [options])`

Shorthand for `{mode: 'pull'}`

#### `var stream = replicator.push(datGraph, [options])`

Shorthand for `{mode: 'push'}`

## Progress monitoring

The stream will emit progress events when pushing / pulling. The events look like this

``` js
stream.on('push', function (event) {
  /*
  {
    transferred: nodesPushedSofar,
    length: nodesToBePushedInTotals
  }
  */
})

stream.on('pull', function (event) {
  /*
  {
    transferred: nodesPulledSofar,
    length: nodesToBePulledInTotals
  }
  */
})
```

You can always access the latest pushed/pulled event as `stream.pushed` and `stream.pulled`.

## License

MIT
