const pg = require("pg");
const { Pool } = pg;
require('dotenv').config();
const { CONNECTION_STRING } = process.env;


const pool = new Pool({

    connectionString: CONNECTION_STRING,

});

const db = {
    query(text, params){
        return pool.query(text, params);
    }
}


module.exports = db;