// LIBRARIES AND MODULES
// ---------------------

// The pg-pool library for PostgreSQL Server
const Pool = require('pg').Pool

// The node-cron library to schedule API call to porssisahko.net
const cron = require('node-cron')

const { transform, prettyPrint } = require('camaro');

// File system
const log = require('./logger')
const fs = require('fs')

// APP SETTINGS
// ------------
// Read settings from JSON file
const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'))

// Create a new pool for Postgres connections
const pool = new Pool(
  settings.database
)

// GET, PROCESS AND SAVE DATA
// --------------------------

class Microservices {
  constructor(pool) {
    this.pool = pool;
    this.lastFetchedDate = settings.lastFetchedDate;
    this.message = '';
  }

  // Fetch latest price data from porssisahko.net and save to database
  async fetchLatestPriceData() {
    const LATEST_PRICES_ENDPOINT = 'https://api.porssisahko.net/v1/latest-prices.json';
    const response = await fetch(LATEST_PRICES_ENDPOINT);
    const json = await response.json();
    return json;
  }
  
  scheduleLatestDataFetch() {
    cron.schedule(settings.scheduler.timepattern, async () => {
      try {
        const timestamp = new Date(); // Get the current timestamp
        const dateStr = timestamp.toLocaleDateString(); // Take datepart of the timestamp
        // If the date of last successful fetch is not the current day, fetch data
        if (this.lastFetchedDate !== dateStr) {
          // Log the start of the operation
          this.message = 'Started fetching price data';
          console.log(this.message);
          log.log(this.message);

          const json = await this.fetchLatestPriceData();
          // Loop through prices data and pick startDate and price elements
          json.prices.forEach(async (element) => {
            const values = [element.startDate, element.price];
            // Build a SQL clause to insert values into table
            const sqlClause = 'INSERT INTO public.hourly_price VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *';
            // Function for running SQL operations asynchronously
            const runQuery = async () => {
              let resultset = await this.pool.query(sqlClause, values);
              return resultset;
            };
            // Call query function and echo results to console
            runQuery().then((resultset) => {
              if (resultset.rows[0] != undefined) {
                this.message = 'Added a row to database';
              } else {
                this.message = 'Skipped an existing row';
              }
              console.log(this.message);
              log.log(this.message);
            });
          });

          this.lastFetchedDate = dateStr; // Set fetch date to current date

          // Update lastFetchedDate in settings
          settings.lastFetchedDate = this.lastFetchedDate;
          
          // Write updated settings back to JSON file
          fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

          this.message = 'Fetched at ' + this.lastFetchedDate;
          console.log(this.message);
          log.log(this.message);
        } else {
          this.message = 'Data was already fetched earlier today';
          console.log(this.message);
          log.log(this.message);
        }
      } catch (error) {
        this.message = 'An error occurred (' + error.toString() + '), trying again in 5 minutes until 4 PM';
        console.log(this.message);
        log.log(this.message);
      }
    });
  }

  // Get the latest, hourly price + timeslot data from the database
  async getCurrentPriceTable() {
    let resultset = await pool.query('SELECT * FROM public.hourly_page');
    return resultset;
}

  // Get the latest, hourly price data from the database
  async getCurrentPrice() {
    let resultset = await pool.query('SELECT price FROM public.current_prices');
    return resultset;
  }

  async getEveningPrice() {
    let resultset = await pool.query('SELECT price FROM public.evening_price');
    return resultset;
  }

  async getLowestPriceToday() {
    let resultset = await pool.query('SELECT price, timeslot FROM public.lowest_price_today');
    return resultset;
  }

  async getHighestPriceToday() {
    let resultset = await pool.query('SELECT price, timeslot FROM public.highest_price_today');
    return resultset;
  }

  async fetchHourlyWeatherData() {
    const response = await fetch('https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::hourly::multipointcoverage&place=turku&parameters=WindDirection,WindSpeedMS,Temperature');

    const xmlData = await response.text();
  
    const template = [
      'wfs:FeatureCollection/wfs:member/omso:GridSeriesObservation/om:result/gmlcov:MultiPointCoverage/gml:rangeSet/gml:DataBlock', 
      {
        data: 'gml:doubleOrNilReasonTupleList'
      }
    ];
    
    (async function () {
      const result = await transform(xmlData, template);

      console.log(result);

      const values = result.map(item => `('${item.windDirection} ${item.windSpeed} ${item.temperature}')`).join(', ');

      console.log(values);
    })();

  }
}

// Export the Microservices class
module.exports = Microservices;

// Create an instance of the Microservices class
const microservices = new Microservices(pool);

// Call the scheduleLatestDataFetch method
microservices.scheduleLatestDataFetch();
// microservices.fetchHourlyWeatherData();