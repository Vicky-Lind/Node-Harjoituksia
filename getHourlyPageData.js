const Pool = require('pg-pool');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'smarthome',
    password: 'viclin123',
    port: 5432,
});

const getCurrentPriceTable = async () => {
    let resultset = await pool.query('SELECT * FROM public.hourly_page');
    return resultset;
}

module.exports = {
    getCurrentPriceTable
};