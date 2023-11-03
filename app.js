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

// Import the Microservices class
const Microservices = require('./microservices');

// Create a new pool for Postgres connections
const pool = new Pool(settings.database);

// Create an instance of the Microservices class
const microservices = new Microservices(pool);


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
  microservices.getCurrentPriceTable().then((resultset) => {
    let tableData = resultset.rows
    let hourlyPageData = {
      'tableData': tableData
    }
    console.log(hourlyPageData)
    res.render('hourly', hourlyPageData)
  })
})

// Tuntihintasivun reitti ja dynaaminen data
app.get('/spot-prices', (req, res) => {

  Promise.all([microservices.getCurrentPrice(), microservices.getCurrentPriceTable(), microservices.getEveningPrice(), microservices.getLowestPriceToday()])
    .then(([priceResult, tableResult, eveningPriceResult, lowestPriceTodayResult]) => {
      
      let priceNow = priceResult.rows[0]['price'];
      let priceEvening = eveningPriceResult.rows[0]['price'];
      let lowestPriceToday = lowestPriceTodayResult.rows[0]['price'];
      let lowestPriceTodayTimeslot = lowestPriceTodayResult.rows[0]['timeslot'];
      let tableData = tableResult.rows;
      
      let data = {
        'priceNow': priceNow,
        'priceEvening': priceEvening,
        'lowestPriceToday': lowestPriceToday,
        'lowestPriceTodayTimeslot': lowestPriceTodayTimeslot,
        'tableData': tableData
      };
      console.log(data);
      res.render('spot_prices', data);
    })
})

app.get('/original', (req, res) => {

  // Handlebars needs a key to show data on a page, json is a good way to send it
  let homePageData = {
      'price': 0,
      'wind': 0,
      'temperature': 0
  };

  microservices.getCurrentPrice().then((resultset) => {
      console.log(resultset.rows[0])

      homePageData.price = resultset.rows[0]['price'];
      
      // Render index.handlebars and send dynamic data to the page
      res.render('original', homePageData)
    })    
});

// PALVELIMEN KÄYNNISTYS
app.listen(PORT)
console.log(`Palvelin kuuntelee porttia ${PORT}`)
