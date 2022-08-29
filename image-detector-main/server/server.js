let express = require("express");
let app = express();

app.use(express.static("../client"));

app.listen(8081, function(){
    console.log("server running at 'http://localhost:8081/index.html'");
});


app.use(express.json({ limit: '1mb' }));
app.post('/api', function(request, response) {
    console.log(request.body);
    response.json({
        status: 'success',
        latitude: request.body.lat,
        longitude: request.body.lon
    });
});

// app.get('/', function(req, res) {
//   res.send('hello world');
// });