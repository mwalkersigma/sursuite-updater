const componentDB = require('../../modules/Postgres/js/index.js');
async function updateComponentDB(productValues) {
    let {rows} =await componentDB.query(`
        UPDATE sursuite.components
        SET     
            title = $2,
            manufacturer = $3,
            description = $4,
            price = $5,
            retail_price = $6,
            condition = $7,
            category = $8,
            weight = $9,
            model = $10,
            create_date_utc = $11,
            update_date_utc = $12,
            date_priced_utc = $13,
            image_last_updated_utc = $14,
            final_approval_date_utc = $15,
            template_approval_status = $16,
            series = $17,
            priced_by = $18,
            final_approval_by = $19,
            image_last_updated_by = $20
        WHERE 
            sku = $1
    `,productValues);
}
async function insertToComponentDB(productValues) {
    let {rows} = await componentDB.query(`
        INSERT INTO sursuite.components 
        (sku, title, manufacturer, description, price, retail_price, condition, category, weight, model, create_date_utc, update_date_utc, date_priced_utc, image_last_updated_utc, final_approval_date_utc, template_approval_status, series, priced_by, final_approval_by, image_last_updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING sku
    `, productValues);
    for(let row of rows){
        // insert to sursuite.components_sales
        await componentDB.query(`
            INSERT INTO sursuite.component_sales(sku)
            VALUES ($1)
        `, [row.sku]);
    }
}
module.exports ={
    updateDB:updateComponentDB,
    insertDB:insertToComponentDB,
}


