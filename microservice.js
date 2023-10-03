// LIBRARIES AND MODULES
// ---------------------

// The pg-pool library for PostgreSQL Server
const Pool = require('pg').Pool

// The node-cron library to schedule API call to porssisahko.net
const cron = require('node-cron')

// Home made library to access price API from porssisahko.net
const getPrices = require('./getNewPrices')

// File system
const log = require('./logger')

// APP SETTINGS
// ------------

// Create a new pool for Postgres connections
const pool = new Pool({
  user: 'postgres', // In production always create a new user for the app
  password: 'viclin123',
  host: 'localhost', // Or localhost or 127.0.0.1 if in the same computer
  database: 'smarthome',
  port: 5432
})

// GET, PROCESS AND SAVE DATA
// --------------------------

// Use a date variable to keep track of successful data retrievals
let lastFetchedDate = '1.1.2023' // Initial value, in production use settings file
let message = ''
// Try to run an operation in 5 minute intervals from 3 to 4 PM

cron.schedule('*/1 16 * * *', () => {
  try {
    const timestamp = new Date() // Get the current timestamp
    const dateStr = timestamp.toLocaleDateString() // Take datepart of the timestamp
    // If the date of last successful fetch is not the current day, fetch data
    if (lastFetchedDate !== dateStr) {

        // Log the start of the operation
        message = 'Started fetching price data'

        console.log(message)
        log.log(message)

      getPrices.fetchLatestPriceData().then((json) => {
        // Loop through prices data and pick starDate and price elements
        json.prices.forEach(async (element) => {
          const values = [element.startDate, element.price]

          // Build a SQL clauset to insert values into table
          const sqlClause =
            'INSERT INTO public.hourly_price VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *'
          // Function for running SQL operations asyncronously
          const runQuery = async () => {
            let resultset = await pool.query(sqlClause, values)
            return resultset
          }
          // Call queryfunction and echo results to console
          runQuery().then((resultset) => {   if (resultset.rows[0] != undefined) {
            message = 'Added a row to database'
          } else {
            message = 'Skipped an existing row'
          }

          console.log(message)
          log.log(message)
        })
      })
      })
      lastFetchedDate = dateStr // Set fetch date to current date
      message = 'Fetched at ' + lastFetchedDate
      console.log(message)
      log.log(message)
    } else {
      message = 'Data was already fetched earlier today'
      console.log(message)
      log.log(message)
    } 
  } catch (error) {
      message = 'An error occured (' + error.toString() + '), trying again in 5 minutes until 4 PM'
      console.log(message)
      log.log(message)
    }
  })