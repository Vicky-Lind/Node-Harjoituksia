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
    const job = new cron.CronJob(settings.scheduler.priceTimepattern, async () => {
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
  async fetchAndCalculateWindData(whatStr, uVectorUrl, vVectorUrl) {
    // Fetch uVector and vVector data
    const uVectorResponse = await fetch(uVectorUrl);
    const vVectorResponse = await fetch(vVectorUrl);
    const uVectorData = await uVectorResponse.json();
    const vVectorData = await vVectorResponse.json();
  
    // Reset all values
    let windAngle = 0; // Wind blows from opposite direction to vector
    let windSpeed = 0; // Wind speed in vector units (m/s)
    let geographicAngle = 0; // Angle of vector in a map
  
    // atan2 returns angle in radians. Arguments are in (y,x) order!
    let xyAngleRad = Math.atan2(vVectorData, uVectorData); 
    let xyAngleDeg = xyAngleRad * 360 /(2 * Math.PI); // convert radians to degrees
    
    // Convert x-y plane directions to geographic directions
    // There is 90 degrees shift between x-y and map directions
    if (xyAngleDeg > 90) {
      geographicAngle = 360 - (xyAngleDeg -90);
    } else {
      geographicAngle = 90 - xyAngleDeg;
    }
    
    // Wind blows from opposite direction
    if (geographicAngle < 180) {
      windAngle = geographicAngle + 180;
    } else {
      windAngle = geographicAngle -180;
    }
  
    // calculate wind speed according to the Pythagoras theorem
    windSpeed = Math.sqrt(uVectorData**2 + vVectorData**2);
    
    // Return all calculated parameters
    return { windSpeed, windAngle };
  }
  async scheduleTemplateWindObservation(placeParam, placeObs) {
    const job = new cron.CronJob(settings.scheduler.weatherTimepattern, async () => {
      try {
        const windSpeedStr = 'wind speed';
        const windDirectionStr = 'wind direction';
        const place = placeObs;

        const windSpeedDBTable = windSpeedStr.replace(" ", "_") + '_observation';
        const windDirectionDBTable = windDirectionStr.replace(" ", "_") + '_observation';

        const WIND_VMS_ENDPOINT = `https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=ecmwf::forecast::surface::point::timevaluepair&place=${placeParam}&parameters=WindVMS`
        const WIND_UMS_ENDPOINT = `https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=ecmwf::forecast::surface::point::timevaluepair&place=${placeParam}&parameters=WindUMS`
        
        const template = ['wfs:FeatureCollection/wfs:member/omso:PointTimeSeriesObservation/om:result/wml2:MeasurementTimeseries/wml2:point/wml2:MeasurementTVP', {
          time: 'wml2:time',
          value: 'wml2:value'
        }];

        const windSpeedSqlClause = `INSERT INTO public.${windSpeedDBTable} VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`;
        const windDirectionSqlClause = `INSERT INTO public.${windDirectionDBTable} VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *`;

        // Log the start of the operation
        this.message = `Started fetching ${windSpeedStr} and ${windDirectionStr} observation data`;
        console.log(this.message);
        log.log(this.message);

        // Fetch uVector and vVector data
        // Fetch uVector and vVector data
        const uVectorResponse = await axios.get(WIND_VMS_ENDPOINT);
        const vVectorResponse = await axios.get(WIND_UMS_ENDPOINT);

        const xml = uVectorResponse.data;
        const xml2 = vVectorResponse.data;

        const result = await transform(xml, template);

        let windSpeedData = windData.windSpeed;
        let windDirectionData = windData.windAngle;


      // Loop through result data and pick elements
      for (const element of windSpeedData) {
        let values = [element.time, element.value, place];

        // Function for running SQL operations asynchronously
        const runQuery = async () => {
          let resultset = await this.pool.query(windSpeedSqlClause, values);
          return resultset;
        };
        
        runQuery().then((resultset) => {
          if (resultset.rows[0] != undefined) {
            this.message = 'Added a row to database';
          } else {
            this.message = 'Skipped an existing row';
          }
          console.log(this.message);
        });
      }

      for (const element of windDirectionData) {
        let values = [element.time, element.value, place];

        // Function for running SQL operations asynchronously
        const runQuery = async () => {
          let resultset = await this.pool.query(windDirectionSqlClause, values);
          return resultset;
        };
        
        runQuery().then((resultset) => {
          if (resultset.rows[0] != undefined) {
            this.message = 'Added a row to database';
          } else {
            this.message = 'Skipped an existing row';
          }
          console.log(this.message);
        });
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }, null, true, 'Europe/Helsinki');
  }
  

  async scheduleTemplateObservation(whatStr, placeParam, paramCode, placeObs) {
    const job = new cron.CronJob(settings.scheduler.weatherTimepattern, async () => {
      try {
        const what = whatStr.toLowerCase();
        const DBTable = what.replace(" ", "_") + '_observation';
        const WEATHER_ENDPOINT = `https://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&place=${placeParam}&parameters=${paramCode}&`;
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
  async scheduleTemplateForecast(whatStr, placeParam, paramCode, placeObs){
    const job = new cron.CronJob(settings.scheduler.weatherTimepattern, async () => {
      try {
        const what = whatStr.toLowerCase();
        const DBTable = what.replace(" ", "_") + '_forecast';
        const WEATHER_ENDPOINT = `https://opendata.fmi.fi/wfs/fin?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=ecmwf::forecast::surface::point::timevaluepair&place=${placeParam}&parameters=${paramCode}`;
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
  async selectXFromY(selectItem, fromItem) {
    let resultset = await pool.query(`SELECT ${selectItem} FROM public.${fromItem}`);
    return resultset;
  }
}

// Create an instance of the Microservices class
const priceMicroservices = new PriceMicroservices(pool);
const weatherMicroservices = new WeatherMicroservices(pool);

priceMicroservices.scheduleLatestPriceDataFetch();


weatherMicroservices.scheduleTemplateWindObservation('turku', 'Turku Artukainen');

weatherMicroservices.scheduleTemplateObservation('Temperature', 'Turku', 't2m', 'Turku Artukainen');

weatherMicroservices.scheduleTemplateForecast('Temperature', 'Turku', 'temperature', 'Turku Artukainen');

// Export the Microservices class
module.exports = {PriceMicroservices, WeatherMicroservices};