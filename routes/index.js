var express = require('express');
var router = express.Router();
var request = require('request');

var app = express();
var config = require('.././config.json')[app.get('env')];

var unirest = require('unirest');
var base_url = "https://connect.squareup.com/v2";

// Data store for product cost
var product_cost = {"001": 100, "002": 4900, "003": 500000};

function findLocation(callback) {
  unirest.get(base_url + '/locations')
  .headers({
    'Authorization': 'Bearer ' + config.squareAccessToken,
    'Accept': 'application/json'
  })
  .end(function(response) {
    for (var i = response.body.locations.length - 1; i >= 0; i--) {
      location = response.body.locations[i];
      if (location.capabilities && location.capabilities.indexOf("CREDIT_CARD_PROCESSING")>-1) {
        callback(location, null);
        return;
      }
      if (i==0) {
        callback(null, {status: 400, errors: [{"detail": "No locations have credit card processing available."}]});
      }
    }
  });
}

/* GET home page. */
router.get('/', function(req, res, next) {
  findLocation(function(location, error){
    if (error) {
      res.json(error);
    } else {
      res.render('index', {
        'title': 'Express Node.js Implementation',
        'square_application_id': config.squareApplicationId,
        'square_location_id': location.id,
        'square_location_name': location.name,
      });
    }
  });
});

router.get('/tax', (req, res, next) => {
  const request_params = req.query;

  console.log(request_params);

  const url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
    request_params.latitude + ',' +
    request_params.longitude +'&key=' +
    config.googleAccessToken;

  console.log(url);

  request.get(url,
    (error, response, body) => {
      console.log(error);
      console.log(response.status);
      var locData = JSON.parse(body);
      console.log(locData.results[0].address_components);
      extractLocation(locData.results[0].address_components);
      return res.json({tax: 123});
    });
});

function extractLocation(loc) {
  var country;
  var state;
  var zip;

  loc.forEach((l) => {
    if (l.types[0] === 'postal_code') {
      zip = l.long_name;
    }else if (l.types[0] === 'country') {
      country = l.long_name.toLowerCase().replace(/[.,\\/#!?$%^&*;:{}=\-_`~()\s']/g, '');
    }else if (l.types[0] === 'administrative_area_level_1') {
      state = l.long_name.toLowerCase().replace(/[.,\\/#!?$%^&*;:{}=\-_`~()\s']/g, '');
    }
  })
  var locData = { country, state, zip };
  console.log('a');
  console.log(locData);
  return locData;
}

router.post('/charges/charge_card', function(req,res,next){
  var request_params = req.body;

  var token = require('crypto').randomBytes(64).toString('hex');

  // Check if product exists
  if (!product_cost.hasOwnProperty(request_params.product_id)) {
    return res.json({status: 400, errors: [{"detail": "Product Unavailable"}] })
  }

  // Make sure amount is a valid integer
  var amount = product_cost[request_params.product_id]

  // To learn more about splitting transactions with additional recipients,
  // see the Transactions API documentation on our [developer site]
  // (https://docs.connect.squareup.com/payments/transactions/overview#mpt-overview).
  request_body = {
    card_nonce: request_params.nonce,
    amount_money: {
      amount: amount,
      currency: 'USD'
    },
    idempotency_key: token
  }

  locationId = request_params.location_id;

  unirest.post(base_url + '/locations/' + locationId + "/transactions")
  .headers({
    'Authorization': 'Bearer ' + config.squareAccessToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  })
  .send(request_body)
  .end(function(response){
    if (response.body.errors){
      res.json({status: 400, errors: response.body.errors})
    }else{
      res.json({status: 200})
    }
  })

});

module.exports = router;
