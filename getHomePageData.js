const Pool = require('pg-pool');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'smarthome',
    password: 'viclin123',
    port: 5432,
});

const getCurrentPrice = async () => {
    let resultset = await pool.query('SELECT price FROM public.current_prices');
    return resultset;
}

module.exports = {
    getCurrentPrice
};