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

// REITTIEN MÄÄRITYKSET
// --------------------

app.get('/', (req, res) => {

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
      res.render('index', homePageData)
    })    
  });
  
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

app.get('/', (req, res) => {
  res.render('index')
})

app.get('/test-home', (req, res) => {
  res.render('test_homepage')
})
// Tuntihintasivun reitti ja dynaaminen data
app.get('/spot-prices', (req, res) => {
  // Testidataa dynaamisen sivun testaamiseksi
  // Data will be represented in a table. To loop all rows we need a key for table and for column data
  const hourlyPageData = {
    tableData: [
      { hour: 8, price: 31.22 },
      { hour: 9, price: 32.55 },
      { hour: 10, price: 31.44 },
      { hour: 11, price: 34.11 }
    ]
  }

  res.render('spot_prices', hourlyPageData)
})


app.get('/bootstrap-test', (req, res) => {
  res.render('bootstrap_test')
})

app.get('/tailwind-test', (req, res) => {
  res.render('tailwind_test')
})

// PALVELIMEN KÄYNNISTYS
app.listen(PORT)
console.log(`Palvelin kuuntelee porttia ${PORT}`)
