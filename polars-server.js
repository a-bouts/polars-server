var express = require("express")
var http = require('http')
var request = require('request')
var fs = require('fs')
var cors = require('cors')
var PNG = require('pngjs').PNG

var app = express()
app.use(express.json())

const PORT = process.env.PORT || 7777
const HOST = process.env.HOST || ""

// cors config
var whitelist = [
  '*'
]

var corsOptions = {
  origin: function(origin, callback){
    var originIsWhitelisted = whitelist.indexOf(origin) !== -1
    callback(null, originIsWhitelisted)
  }
}

app.use('/polars', express.static('polars'))

app.listen(PORT, function(err){
  console.log("Running server on port "+ PORT)
})

app.get('/polars/:race', cors(corsOptions), function(req, res){

  var race = req.params.race
  console.log("Download '" + race + "' polars")

  for (var i = 0; i < 8; i++) {
    const sail = i
    var url = `http://${HOST}/${race}/ideal_${sail}.png?2`
    http.get(url, (r) => {
      const statusCode = r.statusCode;
      if (statusCode !== 200) {
        console.log("Error " + r.statusCode + " downloading file " + url)
      } else {
        r.pipe(new PNG()).on('parsed', function() {
          fs.writeFile('polars/' + race + '_' + sail, Buffer.from(this.data), function (err) {
            if (err) {
              console.log("Error saving file " + race + "_" + sail)
              console.log(err)
            } else {
              console.log("File " + race + "_" + sail + " saved")
            }
          })
        })
      }
    })
  }

  res.status(200).end();
})

function interpolationIndex(values, value) {

  var i = 0
  while(values[i] < value) {
    i++
    if (i == values.length) {
      if (values[i-1] < value) {
        return [i - 1, 0, 1]
      }
      return [i - 1, i, (values[i] - value) / (values[i] - values[i-1])]
    }
  }

  if (i > 0) {
    return [i - 1, i, (values[i] - value) / (values[i] - values[i-1])]
  }

  return [0, 0, 0]
}

app.get('/polars/api/v1/boats/:boat/sails/:sailId', cors(corsOptions), function(req, res){
  var boat = req.params.boat
  var sail = req.params.sailId

  var result = {
    twa: {},
    tws: {}
  }

  fs.readFile('polars/' + boat + '.json', 'utf8', (err, data) => {

    if (err) {
        console.log(`Error reading file from disk: ${err}`);
        res.status(404).end();
    } else {

        // parse JSON string to JSON object
        const polar = JSON.parse(data);

	for (var w = 0 ; w <= 70 ; w+=0.1) {
	  const ws = w.toFixed(1)
          const twsInterpol = interpolationIndex(polar.tws, ws)
          const twsIndex0 = twsInterpol[0]
          const twsIndex1 = twsInterpol[1]
          const twsFactor = twsInterpol[2]
          const unMoinsTwsFactor1 = 1 - twsFactor
          for (var twa = 0 ; twa <= 180 ; twa+=0.1) {
            const t = twa.toFixed(1)
            const twaInterpol = interpolationIndex(polar.twa, t)
            const twaIndex0 = twaInterpol[0]
            const twaIndex1 = twaInterpol[1]
            const twaFactor = twaInterpol[2]
            const unMoinsTwaFactor1 = 1 - twaFactor

            var sailBs = 0
            polar.sail.forEach(s => {
              if (s.id == sail) {
                const ti0 = s.speed[twaIndex0]
                const ti1 = s.speed[twaIndex1]
                sailBs = (ti0[twsIndex0]*twsFactor+ti0[twsIndex1]*(unMoinsTwsFactor1))*twaFactor + (ti1[twsIndex0]*twsFactor+ti1[twsIndex1]*(unMoinsTwsFactor1))*(unMoinsTwaFactor1)
	      }
	    })

            var maxBs = -1
            var maxS = -1
            polar.sail.forEach(s => {

              if (s.id == sail)
                return
              
              const ti0 = s.speed[twaIndex0]
              const ti1 = s.speed[twaIndex1]
              const bs = (ti0[twsIndex0]*twsFactor+ti0[twsIndex1]*(unMoinsTwsFactor1))*twaFactor + (ti1[twsIndex0]*twsFactor+ti1[twsIndex1]*(unMoinsTwsFactor1))*(unMoinsTwaFactor1)

              if (bs > maxBs) {
                maxBs = bs
                maxS = s
              }
            })
            if (maxBs < sailBs * polar.badSailTolerance) {
              if (result.tws[t] === undefined)
                result.tws[t] = {min:{},max:{}}
              if (result.tws[t].min.badSail === undefined || result.tws[t].min.badSail > ws)
                result.tws[t].min.badSail = ws
              if (result.twa[ws] === undefined)
                result.twa[ws] = {min:{},max:{}}
              if (result.twa[ws].min.badSail === undefined || result.twa[ws].min.badSail > t)
                result.twa[ws].min.badSail = t
              if (result.tws[t].max.badSail === undefined || result.tws[t].max.badSail < ws)
                result.tws[t].max.badSail = ws
              if (result.twa[ws].max.badSail === undefined || result.twa[ws].max.badSail < t)
                result.twa[ws].max.badSail = t
	    }
            if (maxBs < sailBs * polar.autoSailChangeTolerance) {
              if (result.tws[t] === undefined)
                result.tws[t] = {min:{},max:{}}
              if (result.tws[t].min.autoSailChange === undefined || result.tws[t].min.autoSailChange > ws)
                result.tws[t].min.autoSailChange = ws
              if (result.twa[ws] === undefined)
                result.twa[ws] = {min:{},max:{}}
              if (result.twa[ws].min.autoSailChange === undefined || result.twa[ws].min.autoSailChange > t)
                result.twa[ws].min.autoSailChange = t
              if (result.tws[t].max.autoSailChange === undefined || result.tws[t].max.autoSailChange < ws)
                result.tws[t].max.autoSailChange = ws
              if (result.twa[ws].max.autoSailChange === undefined || result.twa[ws].max.autoSailChange < t)
                result.twa[ws].max.autoSailChange = t
	    }
            if (maxBs < sailBs) {
              if (result.tws[t] === undefined)
                result.tws[t] = {min:{},max:{}}
              if (result.tws[t].min.best === undefined || result.tws[t].min.best > ws)
                result.tws[t].min.best = ws
              if (result.twa[ws] === undefined)
                result.twa[ws] = {min:{},max:{}}
              if (result.twa[ws].min.best === undefined || result.twa[ws].min.best > t)
                result.twa[ws].min.best = t
              if (result.tws[t].max.best === undefined || result.tws[t].max.best < ws)
                result.tws[t].max.best = ws
              if (result.twa[ws].max.best === undefined || result.twa[ws].max.best < t)
                result.twa[ws].max.best = t
	    }
	  }
	}
      res.json(result)
    }

  })

})

app.get('/polars/-/healthz', function(req, res){

  res.json({ status: "Ok" });
})
