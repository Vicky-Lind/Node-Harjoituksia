const Pool = require("pg").Pool;
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "smarthome",
  password: "viclin123",
  port: 5432,
});
const getUsers = (request, response) => {
  pool.query(
    "SELECT * FROM public.average_by_year",
    (error, results) => {
      if (error) {
        throw error;
      }
      response.status(200).json(results.rows);
    }
  );
};

module.exports = {
  getUsers,
};
