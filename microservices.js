// LIBRARIES AND MODULES
// ---------------------

// The pg-pool library for PostgreSQL Server
const Pool = require('pg').Pool

// The node-cron library to schedule API call to porssisahko.net
const cron = require('cron')

// Axios for using http or https requests to get data
const axios = require('axios');

// Camaro for transforming XML to JSON
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
    },
    null,
    true,
    'Europe/Helsinki'
    );
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
}

class WeatherMicroservices {
  constructor(pool) {
    this.pool = pool;
    this.lastFetchedDate = settings.lastFetchedWeatherDate;
    this.message = '';
  }
  async scheduleTemplate(whatStr, endpoint, templateParam, placeStr, sqlClauseParam) {
    try {
      const what = whatStr.toLowerCase();
      const WEATHER_ENDPOINT = endpoint;
      const template = templateParam;
      const place = placeStr;
      const sqlClause = sqlClauseParam;

      const timestamp = new Date(); // Get the current timestamp
      const dateStr = timestamp.toLocaleDateString(); // Take datepart of the timestamp
      
      // If the date of last successful fetch is not the current day, fetch data
      if (this.lastFetchedDate !== dateStr) {
        // Log the start of the operation
        this.message = `Started fetching ${what} data`;
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
          
        })
        this.lastFetchedWeatherDate = dateStr; // Set fetch date to current date

        // Update lastFetchedDate in settings
        settings.lastFetchedWeatherDate = this.lastFetchedWeatherDate;
        
        // Write updated settings back to JSON file
        fs.writeFileSync('settings.json', JSON.stringify(settings, null, 2));

        this.message = 'Fetched at ' + this.lastFetchedWeatherDate;
        console.log(this.message);
        log.log(this.message);
      } else {
        this.message = 'Data was already fetched earlier today';
        console.log(this.message);
        log.log(this.message);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
  scheduleHourlyTemperatureFetch() {
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
      this.scheduleTemplate(
        'Temperature',
        'https://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&place=Turku&parameters=t2m&',
        ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }],
        'Turku Artukainen',
        'INSERT INTO public.temperature_observation VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *'
      );
    },
    null,
    true,
    'Europe/Helsinki'
    );
  }
  scheduleHourlyWindDirectionFetch() {
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
      this.scheduleTemplate(
        'Wind direction',
        'https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=fmi::observations::weather::timevaluepair&place=Turku&parameters=WindDirection',
        ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }],
        'Turku Artukainen',
        'INSERT INTO public.wind_direction_observation VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *'
      );
    },
    null,
    true,
    'Europe/Helsinki'
    );
  }
  scheduleHourlyWindSpeedFetch() {
    const job = new cron.CronJob(settings.scheduler.timepattern, async () => {
      this.scheduleTemplate(
        'Wind speed',
        'https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=fmi::observations::weather::timevaluepair&place=Turku&parameters=WindSpeedMS',
        ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }],
        'Turku Artukainen',
        'INSERT INTO public.wind_speed_observation VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *'
      );
    },
    null,
    true,
    'Europe/Helsinki'
    );
  }
}

// Export the Microservices class
module.exports = PriceMicroservices, WeatherMicroservices;

// Create an instance of the Microservices class
const priceMicroservices = new PriceMicroservices(pool);
const weatherMicroservices = new WeatherMicroservices(pool);

priceMicroservices.scheduleLatestPriceDataFetch();
weatherMicroservices.scheduleHourlyTemperatureFetch();
weatherMicroservices.scheduleHourlyWindDirectionFetch();
weatherMicroservices.scheduleHourlyWindSpeedFetch();