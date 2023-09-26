// WEB-PALVELIN SÄHKÖN HINNAN SEURANTAAN JA ENNUSTAMISEEN
// ======================================================

// KIRJASTOJEN LATAUKSET
// ---------------------

// Ladataan tarvittavat Express kirjastot
const express = require('express')
const { engine } = require('express-handlebars')

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

// Kotisivun reitti ja dynaaminen data
app.get('/', (req, res) => {
    // Testidataa dynaamisen sivun testaamiseksi
    // Handlebars needs a key to show data on a page, json is a good way to send it
    let homePageData = {
        'price': 32.25,
        'wind': 4,
        'temperature': 21
    }
    // Render index.handlebars and send dynamic data to the page
    res.render('index', homePageData)
})

// Tuntihintasivun reitti ja dynaaminen data
app.get('/spot-prices', (req, res) => {
    // Testidataa dynaamisen sivun testaamiseksi
    // Data will be represented in a table. To loop all rows we need a key for table and for column data
    let hourlyPageData = {
        'tableData': [
            { 'hour': 8, 'price': 31.22 },
            { 'hour': 9, 'price': 32.55 },
            { 'hour': 10, 'price': 31.44 },
            { 'hour': 11, 'price': 34.11 }
        ]
    }

    res.render('spot_prices', hourlyPageData)
})

app.get('/test-homepage', (req, res) => {
    res.render('test_homepage')
})

app.get('/test-homepage-mobile', (req, res) => {
    res.render('test_homepage_mobile')
})

// PALVELIMEN KÄYNNISTYS
app.listen(PORT)
console.log(`Palvelin kuuntelee porttia ${PORT}`)

// Create cron to output "hello" every other second in console
// const cron = require('node-cron')
// const job = cron.schedule('*/2 * * * * *', () => {
//     console.log('hello')
// })
// var CronJob = require('cron').CronJob;
// var job = new CronJob(
//     '* * * * * *',
//     function() {
//         console.log('You will see this message every second');
//     },
//     null,
//     true,
//     'America/Los_Angeles'
// );
// job.start() - See note below when to use this
