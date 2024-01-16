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

const weatherMicroservices = new WeatherMicroservices(pool);

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
app.get('/:lang/', async (req, res) => {
  try {
    const lang = req.params.lang;
    const priceResult = await priceMicroservices.selectXFromY('price', 'current_prices')
    const tableResult = await priceMicroservices.selectXFromY('*', 'hourly_page')
    const priceLowest = await priceMicroservices.selectXFromY('*', 'lowest_price_today')
    const priceHighest = await priceMicroservices.selectXFromY('*', 'highest_price_today')

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
  } catch (err) {
    console.error(err.message);
  }
});
app.get('/:lang/general', async (req, res) => {
  try {
    const lang = req.params.lang;
    const priceResult = await priceMicroservices.selectXFromY('price', 'current_prices')
    const tableResult = await priceMicroservices.selectXFromY('*', 'hourly_page')
    const averagePriceTodayResult = await priceMicroservices.selectXFromY('average', 'average_price_today')
    const eveningPriceResult = await priceMicroservices.selectXFromY('price', 'evening_price_today')
    const lowestPriceTodayResult = await priceMicroservices.selectXFromY('*', 'lowest_price_today')
    const highestPriceTodayResult = await priceMicroservices.selectXFromY('*', 'highest_price_today')
    const TemperatureResult = await weatherMicroservices.selectXFromY('temperature', 'current_weather_forecast')
    const WindResult = await weatherMicroservices.selectXFromY('wind_direction, wind_speed', 'current_weather_forecast')
    
    let priceNow = priceResult.rows[0]['price'];
    let priceEvening = eveningPriceResult.rows[0]['price'];
    let lowestPriceToday = lowestPriceTodayResult.rows[0]['price'];
    let lowestPriceTodayTimeslot = lowestPriceTodayResult.rows[0]['timeslot'];
    let highestPriceToday = highestPriceTodayResult.rows[0]['price'];
    let highestPriceTodayTimeslot = highestPriceTodayResult.rows[0]['timeslot'];
    let tableData = tableResult.rows;
    let averagePriceToday = averagePriceTodayResult.rows[0]['average'];
    let temperature = TemperatureResult.rows[0]['temperature'];
    let windDirection = WindResult.rows[0]['wind_direction'];
    let windSpeed = parseFloat(WindResult.rows[0]['wind_speed']).toFixed(2);
    
    let data = {
      'priceNow': priceNow,
      'priceEvening': priceEvening,
      'lowestPriceToday': lowestPriceToday,
      'lowestPriceTodayTimeslot': lowestPriceTodayTimeslot,
      'highestPriceToday': highestPriceToday,
      'highestPriceTodayTimeslot': highestPriceTodayTimeslot,
      'tableData': tableData,
      'averagePriceToday': averagePriceToday,
      'temperature': temperature,
      'windDirection': windDirection,
      'windSpeed': windSpeed,
      'layout': `../${lang}/layouts/main`
    };
    res.render(`${lang}/generalv4`, data);
  } catch (err) {
    console.error(err.message);
  }
});
/* prices today hourly, average price today hourly, this week daily, average price this week daily, this month daily, average price this month daily, this year monthly, average price this year monthly, and comparions for all of these to last year */
app.get('/:lang/spot-prices', (req, res) => {
  const lang = req.params.lang;
  Promise.all([priceMicroservices.selectXFromY('*', 'hourly_page'), // Price now AND hourly table data (from now forward),
  priceMicroservices.selectXFromY('average', 'average_price_today'), // Average price today
  priceMicroservices.selectXFromY('*', 'highest_price_today'), // Highest price today
  priceMicroservices.selectXFromY('*', 'lowest_price_today'), // Lowest price today

  priceMicroservices.selectXFromY('*', 'prices_today'), // Hourly prices for today table (full)
  priceMicroservices.selectXFromY('*', 'compare_prices_today'), // Compare prices for today (full) from last year

  priceMicroservices.selectXFromY('*', 'prices_this_week_hourly'), // Prices today, in hourly form (full)
  priceMicroservices.selectXFromY('*', 'prices_this_week_daily'), // Prices this week, in daily form (full)
  priceMicroservices.selectXFromY('average_price', 'prices_this_week_average'), // Average this week

  priceMicroservices.selectXFromY('*', 'prices_this_month_daily'), // Prices this month, in daily form (full)
  priceMicroservices.selectXFromY('average_price', 'prices_this_month_average'), // Average this month

  priceMicroservices.selectXFromY('*', 'prices_this_year_monthly'), // Prices this year, in monthly form (full)
  priceMicroservices.selectXFromY('average_price', 'prices_this_year_average'), // Average this year

  ]) 
    .then(([priceResult,
      averagePriceTodayResult,
      highestPriceTodayResult,
      lowestPriceTodayResult,

      pricesTodayResult,
      comparePricesTodayResult,

      pricesThisWeekHourlyResult,
      pricesThisWeekDailyResult,
      pricesThisWeekAverageResult,

      pricesThisMonthDailyResult,
      pricesThisMonthAverageResult,

      pricesThisYearMonthlyResult,
      pricesThisYearAverageResult

    ]) => {
      
      let priceNow = priceResult.rows[0]['price'];
      let tableData = priceResult.rows;

      let averagePriceToday = averagePriceTodayResult.rows[0]['average'];

      let highestPriceToday = highestPriceTodayResult.rows[0]['price'];
      let highestPriceTodayTimeslot = highestPriceTodayResult.rows[0]['timeslot'];

      let lowestPriceToday = lowestPriceTodayResult.rows[0]['price'];
      let lowestPriceTodayTimeslot = lowestPriceTodayResult.rows[0]['timeslot'];

      let EVChargingPriceLow = Math.round(priceNow * 35 / 100);
      let EVChargingPriceHigh = Math.round(priceNow * 100 / 100);

      let CoffeeCupPrice = parseFloat(priceNow * 0.5 / 100).toFixed(2);

      let DishwasherPrice = parseFloat(priceNow * 1.3 / 100).toFixed(2);

      let pricesTodayTable = pricesTodayResult.rows;
      let comparePricesTodayTable = comparePricesTodayResult.rows;

      let pricesThisWeekHourly = pricesThisWeekHourlyResult.rows;
      let pricesThisWeekDaily = pricesThisWeekDailyResult.rows;
      let pricesThisWeekAverage = pricesThisWeekAverageResult.rows[0]['average_price'];

      let pricesThisMonthDaily = pricesThisMonthDailyResult.rows;
      let pricesThisMonthAverage = pricesThisMonthAverageResult.rows[0]['average_price'];

      let pricesThisYearMonthly = pricesThisYearMonthlyResult.rows;
      let pricesThisYearAverage = pricesThisYearAverageResult.rows[0]['average_price'];

      let data = {
        'priceNow': priceNow,
        'averagePriceToday': averagePriceToday,

        'highestPriceToday': highestPriceToday,
        'highestPriceTodayTimeslot': highestPriceTodayTimeslot,

        'lowestPriceToday': lowestPriceToday,
        'lowestPriceTodayTimeslot': lowestPriceTodayTimeslot,
        
        'EVChargingPriceLow': EVChargingPriceLow,
        'EVChargingPriceHigh': EVChargingPriceHigh,

        'CoffeeCupPrice': CoffeeCupPrice,

        'DishwasherPrice': DishwasherPrice,

        'tableData': tableData,
        'pricesTodayTable': pricesTodayTable,
        'comparePricesTodayTable': comparePricesTodayTable,

        'pricesThisWeekHourly': pricesThisWeekHourly,
        'pricesThisWeekDaily': pricesThisWeekDaily,
        'pricesThisWeekAverage': pricesThisWeekAverage,

        'pricesThisMonthDaily': pricesThisMonthDaily,
        'pricesThisMonthAverage': pricesThisMonthAverage,

        'pricesThisYearMonthly': pricesThisYearMonthly,
        'pricesThisYearAverage': pricesThisYearAverage,
        'layout': `../${lang}/layouts/main`
      };
      res.render(`${lang}/spot_prices`, data);
    })
})
app.get('/:lang/weather', (req, res) => {
  const lang = req.params.lang;
  let data = {
    'layout': `../${lang}/layouts/main`
  };
  res.render(`${lang}/weather`, data);
})

app.get('/', (req, res) => {
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
        'priceHighestToday': priceHighestToday
      };
      res.render('index', data);
    })
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