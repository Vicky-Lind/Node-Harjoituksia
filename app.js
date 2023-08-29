// WEB SERVER FOR ELECTRICITY USAGE PLANNING: WEB PAGES AND AN API
// ---------------------------------------------------------------

// LIBRARIES AND MODULES
// ---------------------

// Use Express as web engine
const express = require('express')
// Use Express Handlebars as template engine
const { engine } = require('express-handlebars')

// EXPRESS APPLICATION SETTINGS
// ----------------------------

// Create the server
const app = express()
const PORT = process.env.PORT || 8080

// Set folder paths
// public is for assets
app.use(express.static('public'))
// views is for pages
app.set('views', './views')

// Engine settings
app.engine('handlebars', engine())
app.set('view engine', 'handlebars')

// URL ROUTES
// ----------

// START THE LISTENER
app.listen(PORT)
console.log('Server started and it will listen TCP port', PORT)
