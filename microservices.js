// LIBRARIES AND MODULES
// ---------------------

// The pg-pool library for PostgreSQL Server
const Pool = require('pg').Pool

// The node-cron library to schedule API call to porssisahko.net
const cron = require('cron')

// Axios for using http or https requests to get data
const axios = require('axios');

// Camaro for transforming XML to JSON
// ! Should one find alternative or?...
const { transform } = require('camaro');

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

class PriceMicroservices {
  constructor(pool) {
    this.pool = pool;
    this.lastFetchedDate = settings.lastFetchedPriceDate;
    this.message = '';
  }

  // Fetch latest price data from porssisahko.net and save to database
  async fetchLatestPriceData() {
    const LATEST_PRICES_ENDPOINT = 'https://api.porssisahko.net/v1/latest-prices.json';
    const response = await fetch(LATEST_PRICES_ENDPOINT);
    const json = await response.json();
    return json;
  }
  
  scheduleLatestPriceDataFetch() {
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
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
          settings.lastFetchedPriceDate = this.lastFetchedDate;
          
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
    },
    null,
    true,
    'Europe/Helsinki'
    );
  }
  async selectXFromY(selectItem, fromItem) {
    let resultset = await pool.query(`SELECT ${selectItem} FROM public.${fromItem}`);
    return resultset;
  }
}

class WeatherMicroservices {
  constructor(pool) {
    this.pool = pool;
    this.message = '';
  }
  async scheduleTemplateObservation(whatStr, placeUrl, paramCode, placeObs) {
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
      try {
        const what = whatStr.toLowerCase();
        const DBTable = what.replace(" ", "_") + '_observation';
        const WEATHER_ENDPOINT = `https://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&place=${placeUrl}&parameters=${paramCode}&`;
        const template = ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }];
        const place = placeObs;
        const sqlClause = `INSERT INTO public.${DBTable} VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`;

        // Log the start of the operation
        this.message = `Started fetching ${what} observation data`;
        console.log(this.message);
        log.log(this.message);

        const response = await axios.get(WEATHER_ENDPOINT);
        const xml = response.data;

        const result = await transform(xml, template);
            
        // Loop through result data and pick elements
        result.forEach(async (element) => {
          const values = [element.time, element.value, place];
          console.log(values);

          // Function for running SQL operations asynchronously
          const runQuery = async () => {
            let resultset = await this.pool.query(sqlClause, values);
            return resultset;
          };
          
          runQuery().then((resultset) => {
            if (resultset.rows[0] != undefined) {
              this.message = 'Added a row to database';
            } else {
              this.message = 'Skipped an existing row';
            }
            console.log(this.message);
          })
          
        });
      } catch (error) {
        console.error(`Error: ${error}`);
      }
    }, null, true, 'Europe/Helsinki');
  }
  async scheduleTemplateForecast(whatStr, placeUrl, paramCode, placeObs){
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
      try {
        const what = whatStr.toLowerCase();
        const DBTable = what.replace(" ", "_") + '_forecast';
        const WEATHER_ENDPOINT = `https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=ecmwf::forecast::surface::point::timevaluepair&place=${placeUrl}&parameters=${paramCode}`;
        const template = ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }];
        const place = placeObs;
        const sqlClause = `INSERT INTO public.${DBTable} VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`;
        
        // Log the start of the operation
        this.message = `Started fetching ${what} forecast data`;
        console.log(this.message);
        log.log(this.message);

        const response = await axios.get(WEATHER_ENDPOINT);
        const xml = response.data;

        const result = await transform(xml, template);
            
        // Loop through result data and pick elements
        result.forEach(async (element) => {
          const values = [element.time, element.value, place];

          // Function for running SQL operations asynchronously
          const runQuery = async () => {
            let resultset = await this.pool.query(sqlClause, values);
            return resultset;
          };
          
          runQuery().then((resultset) => {
            if (resultset.rows[0] != undefined) {
              this.message = 'Added a row to database';
            } else {
              this.message = 'Skipped an existing row';
            }
            console.log(this.message);
          })
          
        });
      } catch (error) {
        console.error(`Error: ${error}`);
      }
    }, null, true, 'Europe/Helsinki');
  }
}


// Create an instance of the Microservices class
const priceMicroservices = new PriceMicroservices(pool);
const weatherMicroservices = new WeatherMicroservices(pool);

priceMicroservices.scheduleLatestPriceDataFetch();

weatherMicroservices.scheduleTemplateObservation('Temperature', 'Turku', 't2m', 'Turku Artukainen');
weatherMicroservices.scheduleTemplateObservation('Wind Speed', 'Turku', 'windSpeedMS', 'Turku Artukainen');
weatherMicroservices.scheduleTemplateObservation('Wind Direction', 'Turku', 'windDirection', 'Turku Artukainen');

weatherMicroservices.scheduleTemplateForecast('Temperature', 'Turku', 'temperature', 'Turku Artukainen');
weatherMicroservices.scheduleTemplateForecast('Wind Speed', 'Turku', 'windSpeedMS', 'Turku Artukainen');
weatherMicroservices.scheduleTemplateForecast('Wind Direction', 'Turku', 'windDirection', 'Turku Artukainen');

// Export the Microservices class
module.exports = {PriceMicroservices, WeatherMicroservices};