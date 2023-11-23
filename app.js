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

const { PriceMicroservices } = require('./microservices');

// Create a new pool for Postgres connections
const pool = new Pool(settings.database);

// Create an instance of the PriceMicroservices class
const priceMicroservices = new PriceMicroservices(pool);

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

// REITTIEN MÄÄRITYKSET
// --------------------

app.get('/', (req, res) => {
  res.render('index')
})

app.get('/hourly', (req, res) => {
  priceMicroservices.selectXFromY('*', 'hourly_price').then((resultset) => {
    let tableData = resultset.rows
    let hourlyPageData = {
      'tableData': tableData
    }
    res.render('hourly', hourlyPageData)
  })
})

// Tuntihintasivun reitti ja dynaaminen data
app.get('/general', (req, res) => {

  Promise.all([priceMicroservices.selectXFromY('price', 'current_prices'),
  priceMicroservices.selectXFromY('*', 'hourly_page'),
  priceMicroservices.selectXFromY('price', 'evening_price'),
  priceMicroservices.selectXFromY('price, timeslot', 'lowest_price_today'),
  priceMicroservices.selectXFromY('price, timeslot', 'highest_price_today'),
  ]) 
    .then(([priceResult,
      tableResult,
      eveningPriceResult,
      lowestPriceTodayResult,
      highestPriceTodayResult,
    ]) => {
      
      let priceNow = priceResult.rows[0]['price'];
      let priceEvening = eveningPriceResult.rows[0]['price'];
      let lowestPriceToday = lowestPriceTodayResult.rows[0]['price'];
      let lowestPriceTodayTimeslot = lowestPriceTodayResult.rows[0]['timeslot'];
      let highestPriceToday = highestPriceTodayResult.rows[0]['price'];
      let highestPriceTodayTimeslot = highestPriceTodayResult.rows[0]['timeslot'];
      let tableData = tableResult.rows;
      
      let data = {
        'priceNow': priceNow,
        'priceEvening': priceEvening,

        'lowestPriceToday': lowestPriceToday,
        'lowestPriceTodayTimeslot': lowestPriceTodayTimeslot,

        'highestPriceToday': highestPriceToday,
        'highestPriceTodayTimeslot': highestPriceTodayTimeslot,

        'tableData': tableData
      };
      res.render('generalv2', data);
    })
})

app.get('/original', (req, res) => {

  // Handlebars needs a key to show data on a page, json is a good way to send it
  let homePageData = {
      'price': 0,
      'wind': 0,
      'temperature': 0
  };

  priceMicroservices.selectXFromY('price', 'current_prices').then((resultset) => {
      homePageData.price = resultset.rows[0]['price'];
      
      // Render index.handlebars and send dynamic data to the page
      res.render('original', homePageData)
    })    
});

// PALVELIMEN KÄYNNISTYS
app.listen(PORT)
console.log(`Palvelin kuuntelee porttia ${PORT}`)
