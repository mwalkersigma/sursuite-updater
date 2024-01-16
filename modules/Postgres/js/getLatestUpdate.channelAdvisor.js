module.exports = function getLatestUpdateDate(){
    return db.query(`
        SELECT
            date_priced
        FROM
            surtrics.surplus_pricing_data
        ORDER BY
            date_priced DESC
        LIMIT 1;
    `)
    .then(({rows})=>rows[0]?.['date_priced'])
    .catch((err)=>Logger.log(err))
};

