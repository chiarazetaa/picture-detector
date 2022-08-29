var link = ""; // global variable for image links (if exists)


/*****  LOAD MODEL  *****/

let model;
async function loadModel() {
  // display model loading
  console.log("model loading..");
  loader = document.getElementById("progress-box");
  load_button = document.getElementById("load-button");
  loader.style.display = "block";
  // model name is "mobilenet"
  modelName = "mobilenet";
  // clear the model variable
  model = undefined;
  // load the model (where you have stored your model files)
  model = await tf.loadModel(`http://localhost:8081/mobilenet/model.json`);
  // hide model loading
  console.log("model loaded..");
  loader.style.display = "none";
  load_button.disabled = true;
  load_button.innerHTML = "Model Loaded";
}


/*****  LOAD IMAGE FROM PC  *****/

function showImage(){
    $('.image-show').show();
    $('.pred-show').hide();
    $('#bb').empty();
    link = "";
    let reader = new FileReader();
    reader.onload = function(){
        let dataURL = reader.result;
        $("#selected-image").attr("src",dataURL);
        $("#prediction-list").empty();
    }
    let file = $("#image-selector").prop('files')[0];
    reader.readAsDataURL(file);
    document.getElementById("image-selector").value = "";
}


/*****  IMAGES FROM INSTAGRAM  *****/

function load() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async function(position){
            let lat = position.coords.latitude;
            let lon = position.coords.longitude;

            let data = {lat, lon};
            let options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            };
            let response = await fetch('/api', options);
            let json = await response.json();
            console.log(json);
        });
    } else {
        console.log('geolocation not available');
    }
}

// load image from IG
function imageIG() {
  var search = $('#search').val(); // which tag or user search for
  var num = parseInt($('#num').val()); // number of posts
  var searchUrl  = ''; // json
  var type = ''; // tag or user

  if (search.indexOf('@') != -1) {
    type = 'user';
    search = search.split('@')[1]
  } else if (search.indexOf('#') != -1) {
    type = 'tag';
    search = search.split('#')[1]
  }
  // different links for user or tag
  switch (type) {
    case 'user':
      searchUrl = 'https://www.instagram.com/' + search;
      break;
    case 'tag':
      searchUrl = 'https://www.instagram.com/explore/tags/' + search + '/?__a=1';
      break;
  }

  $.get(searchUrl, function(data, status) {
    $('.posts').empty();
    if (type != 'user' && type != 'tag') {
      $('.posts').append('Use "@" for usernames and "#" for tags.<br>');
    }
    if(num <= 9 &&  num > 0){
      for(var i = 0; i < num; i++) {
        if(type == 'user') {
          var datas = JSON.parse(data.split("window._sharedData = ")[1].split(";<\/script>")[0]).entry_data.ProfilePage[0].graphql;
          if(datas.user.edge_owner_to_timeline_media.edges == ""){
            $('.posts').html('The user has a private profile.<br>');
          } else {
            var $this = datas.user.edge_owner_to_timeline_media.edges[i].node;
            var a = $this.thumbnail_resources[1].src;
            var b = $this.shortcode;
            //console.log(datas);
            //console.log($this);
            $('.posts').append('<button style="padding:0px; margin:10px" onclick=\"sel(\'' + a + '\', \'' + b + '\')\"><img src="'+a+'"></button>');
          }
        }
        else if(type == 'tag') {
          // edge_hashtag_to_top_posts -> most popular
          // edge_hashtag_to_media -> most recent
          var $this = data.graphql.hashtag.edge_hashtag_to_top_posts.edges[i].node;
          var a = $this.thumbnail_resources[1].src;
          var b = $this.shortcode;
          //console.log(data);
          //console.log($this);
          $('.posts').append('<button style="padding:0px; margin:10px" onclick=\"sel(\'' + a + '\', \'' + b + '\')\"><img src="'+a+'"></button>');
        }
      }
    }  else {
      $('.posts').append('Can\'t load more than 9 post or less than 1 post.<br>');
    }
  }).fail(function(data, status) {
    $('.posts').empty();
    if(data.status == 404 && type == 'user') {
      $('.posts').append('User doesn\'t exist.<br>');
    } else if(data.status == 404 && type == 'tag') {
      $('.posts').append('Hashtag doesn\'t exist.<br>');
    }
  });
}

// show the selected IG image
function sel(a,b){
    $('#bb').empty();
    $('#myModal').modal('toggle');
    $('.image-show').show();
    $('.pred-show').hide();
    $("#selected-image").attr("src",a);
    $('#bb').append('<a target="_blank" class="butn" href="https://www.instagram.com/p/'+b+'">View on IG</a><br>');
    link = b;
}

// clean the IG modal
function cleanModal(){
    $('#search').val("");
    $('#num').val("");
    $('.posts').empty();
}


/*****  PREPROCESS IMAGE (to be mobilenet friendly)  *****/

function preprocessImage(image, modelName) {
  // resize the input image to mobilenet's target size of (224, 224)
  let tensor = tf.fromPixels(image)
    .resizeNearestNeighbor([224, 224])
    .toFloat();
  // if model is not available, send the tensor with expanded dimensions
  if (modelName == undefined) {
    return tensor.expandDims();
  }
  // if model is mobilenet, feature scale tensor image to range [-1, 1]
  else if (modelName == "mobilenet") {
    let offset = tf.scalar(127.5);
    return tensor.sub(offset)
      .div(offset)
      .expandDims();
  }
  // else throw an error
  else {
    alert("Unknown model name..")
  }
}


/*****  MAKE PREDICTION  *****/

// check if localStorage already exists, else get an empty array
let itemsArray = localStorage.getItem('items') ? JSON.parse(localStorage.getItem('items')) : [];
async function getPrediction() {
  var elem = document.getElementById('selected-image');
  var s = elem.getAttribute('src');

  // check if model loaded
  if (model == undefined) {
    alert("Please load the model first..")
  }
  // check if image loaded
  else if(s == "") {
    alert("Please load an image first..")
  }
  else if((model != undefined) && (s != "")){

    let image = $('#selected-image').get(0);

    let tensor = preprocessImage(image, modelName);

    // make predictions on the preprocessed image tensor
    let predictions = await model.predict(tensor).data();

    // get the model's prediction results
    let results = Array.from(predictions)
      .map(function (p, i) {
        return {
          probability: p*100,
          className: IMAGENET_CLASSES[i]
        };
      }).sort(function (a, b) {
        return b.probability - a.probability;
      }).slice(0, 5);

    // display predictions of the model
    $("#prediction").empty();
    $("#prediction-list").empty();
    $('.pred-show').show();

    // TOP 1
    if(results[0].probability.toFixed(2) >= 70){
      document.getElementById("prediction").innerHTML = "<span class='green'><b>" + results[0].className + "</b></span> - " + results[0].probability.toFixed(2) + "%";
    }else if(results[0].probability.toFixed(2) >= 40){
      document.getElementById("prediction").innerHTML = "<span class='orange'><b>" + results[0].className + "</b></span> - " + results[0].probability.toFixed(2) + "%";
    }else if(results[0].probability.toFixed(2) < 40){
      document.getElementById("prediction").innerHTML = "<span class='red'><b>" + results[0].className + "</b></span> - " + results[0].probability.toFixed(2) + "%";
    }

    // TOP 5
    results.forEach(function(p){
        var li = document.createElement("LI");
        li.innerHTML = p.className + " : " + p.probability.toFixed(2) + "%";
        $("#prediction-list").append(li);
    });

    var cn1 = results[0].className;
    var pb1 = results[0].probability.toFixed(2);
    var cn2 = "";
    var pb2 = "";

    var locN = "";
    var lat = "";
    var lng = "";

    if(results[1].probability.toFixed(2) >= 20){
      cn2 = results[1].className;
      pb2 = results[1].probability.toFixed(2);
    }

    if(link != ""){
      var searchUrl = 'https://www.instagram.com/p/' + link ;
      $.get(searchUrl, function(data, status) {
        var datas = JSON.parse(data.split("window._sharedData = ")[1].split(";<\/script>")[0]).entry_data.PostPage[0].graphql;
        var location = datas.shortcode_media.location;
        if(location != null){
          var search2 = 'https://www.instagram.com/explore/locations/' + location.id;
          $.get(search2, function(data, status) {
            var datas = JSON.parse(data.split("window._sharedData = ")[1].split(";<\/script>")[0]).entry_data.LocationsPage[0].graphql;
            locN = datas.location.name;
            lat = datas.location.lat;
            lng = datas.location.lng;

            document.getElementById("ss").innerHTML =
            "<button class='butn' id='save' onclick=\'storageSave({lk:\"" + link + "\", cn1:\"" + cn1 + "\", cn2:\"" + cn2 + "\", s:\"" + s
            + "\", pb1:\"" + pb1 + "\", pb2:\"" + pb2 + "\", locN:\"" + locN + "\", lat:\"" + lat + "\", lng:\"" + lng + "\"})\'>Save Prediction</button>";

          });
        } else {
          document.getElementById("ss").innerHTML =
          "<button class='butn' id='save' onclick=\'storageSave({lk:\"" + link + "\", cn1:\"" + cn1 + "\", cn2:\"" + cn2 + "\", s:\"" + s
          + "\", pb1:\"" + pb1 + "\", pb2:\"" + pb2 + "\", locN:\"null\", lat:\"null\", lng:\"null\"})\'>Save Prediction</button>";
        }

      });
    } else {
      document.getElementById("ss").innerHTML =
      "<button class='butn' id='save' onclick=\'storageSave({lk:\"null\", cn1:\"" + cn1 + "\", cn2:\"" + cn2 + "\", s:\"" + s
      + "\", pb1:\"" + pb1 + "\", pb2:\"" + pb2 + "\", locN:\"null\", lat:\"null\", lng:\"null\"})\'>Save Prediction</button>";
    }

  }
}


/*****  WEB STORAGE  *****/
function storageSave(item){
  save_btn = document.getElementById("save");
  save_btn.disabled = true;
  save_btn.innerHTML = "Saved";
  // console.log(item.locN);
  // console.log(item.lat);
  // console.log(item.lng);
  itemsArray.push(item);
  localStorage.setItem('items', JSON.stringify(itemsArray));
}

function getStoredImg(){
  $("#rowww").show();
  $("#verified").empty();
  $("#pending").empty();
  $("#uncertain").empty();
  $("#no").empty();
  const data = JSON.parse(localStorage.getItem('items'));
  //console.log(data);
  if(localStorage.length != 0){
    for(var i = 0; i < itemsArray.length; i++) {
      if (typeof(Storage) !== "undefined") {
        // Retrieve in the right place
        if(data[i].pb1 >= 70){ //verified
          $("#verified").append("<img src='"+data[i].s+"' width='300'>");
          $("#verified").append("<br><br><span class='green'>" + data[i].cn1 + "</span> - " + data[i].pb1 + "%");
          if(data[i].cn2 != ""){
            $("#verified").append("<br><br><span class='green'>" + data[i].cn2 + "</span> - " + data[i].pb2 + "%");
          }
          if(data[i].locN != "null"){
            $("#verified").append("<br><br><i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN);
          }
          $("#verified").append("<br><br><a class='butn' style='font-size: 0.9em;' target'_black' href='https://www.inaturalist.org/'>Load to iNaturalist</a>");
          if(data[i].lk != "null"){
            $("#verified").append("<a target='_blank' style='font-size: 0.9em;' class='butn' href='https://www.instagram.com/p/" + data[i].lk + "'>View on IG</a>");
          }
          $("#verified").append('<button class="butn" onclick=\"delItem(\''
          + data[i] + '\', \'' + i + '\')\"><i class="fa fa-trash-o" style="font-size:24px"></i></button>');
          $("#verified").append("<hr class='riga'>");
        }
        else if(data[i].pb1 >= 40){ //pending
          $("#pending").append("<img src='"+data[i].s+"' width='300'>");
          $("#pending").append("<br><br><span class='orange'>" + data[i].cn1 + "</span> - " + data[i].pb1 + "%");
          if(data[i].cn2 != ""){
            $("#pending").append("<br><br><span class='orange'>" + data[i].cn2 + "</span> - " + data[i].pb2 + "%");
          }
          if(data[i].locN != "null"){
            $("#pending").append("<br><br><i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN);
          }
          $("#pending").append("<br><br><a class='butn' style='font-size: 0.9em;' target'_black' href='https://www.inaturalist.org/'>Load to iNaturalist</a>");
          if(data[i].lk != "null"){
            $("#pending").append("<a target='_blank' style='font-size: 0.9em;' class='butn' href='https://www.instagram.com/p/" + data[i].lk + "'>View on IG</a>");
          }
          $("#pending").append('<button class="butn" onclick=\"delItem(\''
          + data[i] + '\', \'' + i + '\')\"><i class="fa fa-trash-o" style="font-size:24px"></i></button>');
          $("#pending").append("<hr class='riga'>");
        }
        else if(data[i].pb1 < 40){ //uncertain
          $("#uncertain").append("<img src='"+data[i].s+"' width='300'>");
          $("#uncertain").append("<br><br><span class='red'>" + data[i].cn1 + "</span> - " + data[i].pb1 + "%");
          if(data[i].cn2 != ""){
            $("#uncertain").append("<br><br><span class='red'>" + data[i].cn2 + "</span> - " + data[i].pb2 + "%");
          }
          if(data[i].locN != "null"){
            $("#uncertain").append("<br><br><i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN);
          }
          $("#uncertain").append("<br><br><a class='butn' style='font-size: 0.9em;' target'_black' href='https://www.inaturalist.org/'>Load to iNaturalist</a>");
          if(data[i].lk != "null"){
            $("#uncertain").append("<a target='_blank' style='font-size: 0.9em;' class='butn' href='https://www.instagram.com/p/" + data[i].lk + "'>View on IG</a>");
          }
          $("#uncertain").append('<button class="butn" onclick=\"delItem(\''
          + data[i] + '\', \'' + i + '\')\"><i class="fa fa-trash-o" style="font-size:24px"></i></button>');
          $("#uncertain").append("<hr class='riga'>");
        }
      }else{
        if ($('#no').is(':empty')){
          $("#no").append("<p>Sorry, your browser does not support Web Storage...</p>");
        }
      }
    }
  } else {
    if ($('#no').is(':empty')){
      $("#no").append("<p>No predictions saved in Web Storage...</p>");
    }
  }

}

function delItem(data, i){
  itemsArray.splice(i, 1);
  //console.log(itemsArray);
  localStorage.setItem('items', JSON.stringify(itemsArray));
  location.reload();
  alert("Deleting image...");
}

function clearStoredImg() {
  itemsArray.length = 0;
  localStorage.clear();
  $("#verified").empty();
  $("#pending").empty();
  $("#uncertain").empty();
  $("#rowww").hide();
  if ($('#no').is(':empty')){
    $("#no").append("<p>No predictions saved in Web Storage...</p>");
  }
}

/*****  MAP  *****/

var map;
// Initialize and add the map
function initMap() {
  // The location of Uluru
  var bolo = {lat: 44.5075, lng: 11.3514};
  // The map, centered at Uluru
  map = new google.maps.Map(
      document.getElementById('map'), {zoom: 4, center: bolo});

  const data = JSON.parse(localStorage.getItem('items'));
  console.log(data);
  if(localStorage.length != 0){
    for(var i = 0; i < itemsArray.length; i++) {
      if (typeof(Storage) !== "undefined") {
        if(data[i].lat != "null" && data[i].lng != "null"){
          var n1 = parseFloat(data[i].lat);
          var n2 = parseFloat(data[i].lng);
          var pos = {lat: n1, lng: n2};

          if(data[i].pb1 >= 70){ //verified
            var pinColor = "00CC00";
          }
          else if(data[i].pb1 >= 40){ //pending
            var pinColor = "FFA500";
          }
          else if(data[i].pb1 < 40){ //uncertain
            var pinColor = "FF222A";
          }

          var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor,
                          new google.maps.Size(21, 34),
                          new google.maps.Point(0,0),
                          new google.maps.Point(10, 34));


          var mark = new google.maps.Marker({position: pos, map: map, icon: pinImage});

          var contentString = '<div style="color:black">'
                      + '<b style="color:'+pinColor+'">' + data[i].cn1 + '</b> - ' + data[i].pb1 + '%'
                      + '<br><br> <i class="fa fa-map-marker" style="font-size:20px"></i> ' + data[i].locN
                      +'<br><br><img width="300" src="'+data[i].s+'">'
                      +'</div>';
          addInfoWindow(mark, contentString);

        }
      }
    }
  }

}

function addInfoWindow(marker, message) {

    var infoWindow = new google.maps.InfoWindow({
        content: message,
        maxWidth: 500
    });

    google.maps.event.addListener(marker, 'click', function () {
        infoWindow.open(map, marker);
    });
}

function getPos(){
  const data = JSON.parse(localStorage.getItem('items'));
  if(localStorage.length != 0){
    for(var i = 0; i < itemsArray.length; i++) {
      if (typeof(Storage) !== "undefined") {
        if(data[i].lat != "null" && data[i].lng != "null"){
          if(data[i].pb1 >= 70){ //verified
            $("#loc").append("<p><span class='green'>" + data[i].cn1 + "</span> --> <i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN + " ( " + data[i].lat + " ; " + data[i].lng + " )</p>");
          }
          else if(data[i].pb1 >= 40){ //pending
            $("#loc").append("<p><span class='orange'>" + data[i].cn1 + "</span> --> <i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN + " ( " + data[i].lat + " ; " + data[i].lng + " )</p>");
          }
          else if(data[i].pb1 < 40){ //uncertain
            $("#loc").append("<p><span class='red'>" + data[i].cn1 + "</span> --> <i class='fa fa-map-marker' style='font-size:20px'></i> " + data[i].locN + " ( " + data[i].lat + " ; " + data[i].lng + " )</p>");
          }
        }
        // else {
        //   $("#loc").append("<p>" + data[i].cn1 + " --> position undefined</p>");
        // }
      }
    }
  }
}
