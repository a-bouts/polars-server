var express = require("express")
var http = require('http')
var request = require('request')
var fs = require('fs')
var cors = require('cors')
var PNG = require('pngjs').PNG

var app = express()
app.use(express.json())

const PORT = process.env.PORT || 7777
const DDL_HOST = process.env.DDL_HOST || ""

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

app.listen(PORT, function(err){
  console.log("Running server on port "+ PORT)
})

app.get('/polars/:race', cors(corsOptions), function(req, res){

  var race = req.params.race
  console.log("Download '" + race + "' polars")

  for (var i = 0; i < 8; i++) {
    const sail = i
    var url = `http://${DDL_HOST}/${race}/ideal_${sail}.png?2`
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
