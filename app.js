// WEB-PALVELIN SÄHKÖN HINNAN SEURANTAAN JA ENNUSTAMISEEN
// ======================================================

// KIRJASTOJEN LATAUKSET
// ---------------------

// Ladataan tarvittavat Express kirjastot
const express = require('express')
const { engine } = require('express-handlebars')

const { Pool } = require('pg')

const fs = require('fs')

// APP SETTINGS
// ------------
// Read settings from JSON file
const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'))

const { PriceMicroservices, WeatherMicroservices } = require('./microservices');

// Create a new pool for Postgres connections
const pool = new Pool(settings.database);

// Create an instance of the PriceMicroservices class
const priceMicroservices = new PriceMicroservices(pool);

const weatherMicroservices = new WeatherMicroservices();

// EXPRESS-SOVELLUKSEN ASETUKSET
// -----------------------------

// Luodaan Express-sovellus ja määritellään kuunneltava TCP-portti ympäristömuuttujasta tai 8080
const app = express()
const PORT = process.env.PORT || 8080

// Määritellään resurssien, kuten css-tiedostojen kansioksi public
app.use(express.static('public'))

// Määritellään mallineiden käyttöasetukset
app.engine('handlebars', engine())
app.set('view engine', 'handlebars')

// Määritellään hakemisto, josta näkymät (sivut) löytyvät
app.set('views', './views')

var Handlebars = require('handlebars');

Handlebars.registerHelper('formatDate', function(dateString) {
  var date = new Date(dateString);
  var hours = date.getHours();
  hours = hours < 10 ? '0'+hours : hours; // Add leading zero to hours
  var minutes = date.getMinutes();
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes;
  return strTime;
});

Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

// REITTIEN MÄÄRITYKSET
// --------------------
// A default url that doesn't include lang part, will be redirected to the finnish version
app.get('/', function(req, res){
  res.redirect('/fi');
});
app.get('/:lang/', (req, res) => {
  const lang = req.params.lang;
  Promise.all([priceMicroservices.selectXFromY('price', 'current_prices'),
  priceMicroservices.selectXFromY('*', 'hourly_page'),
  priceMicroservices.selectXFromY('*', 'lowest_price_today'),
  priceMicroservices.selectXFromY('*', 'highest_price_today'),])

    .then(([priceResult, tableResult, priceLowest, priceHighest]) => {
      let priceNow = priceResult.rows[0]['price'];
      let tableData = tableResult.rows;

      let priceLowestToday = priceLowest.rows[0]['price'];
      let priceHighestToday = priceHighest.rows[0]['price'];

      let data = {
        'priceNow': priceNow,
        'tableData': tableData,
        'priceLowestToday': priceLowestToday,
        'priceHighestToday': priceHighestToday,
        'layout': `../${lang}/layouts/main`
      };
  res.render(`${lang}/index`, data);
  });
});

// PALVELIMEN KÄYNNISTYS
app.listen(PORT)
console.log(`Palvelin kuuntelee porttia ${PORT}`)
