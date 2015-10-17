# dat-stream-replicator

Streaming replicator for [dat-graph](https://github.com/mafintosh/dat-graph)

```
npm install dat-stream-replicator
```

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

#### `var stream = replicator(datGraph)`

Create a new replication stream for a [dat-graph](https://github.com/mafintosh/dat-graph) instance.
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
