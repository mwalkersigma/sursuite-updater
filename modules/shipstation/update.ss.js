const {parse} = require("csv-parse");
const fs = require("fs");

const {PromisePool} = require("@supercharge/promise-pool")

// perf hooks
const shipStationToken = process.env.SHIPSTATION_TOKEN;

const db = require("../Postgres/js/index.js");
const {buildURL} = require("./buildUrl");


async function getShipStationOrders(options, log) {
    const baseUrl = "https://ssapi.shipstation.com";
    const endpoint = "/orders";
    let results = [];
    while (true) {
        let fullUrl = buildURL(baseUrl, endpoint, options).href;

        let headers ={
            "Authorization": "Basic " + shipStationToken
        }
        let response = await fetch(fullUrl, {
            method: "GET",
            headers: headers
        });
        const {status} = response;
        if(status !== 200) {
            break;
        }
        let data = await response.json();
        const {page,pages,orders} = data;
        results = results.concat(orders);
        if(page === pages) {
            break;
        }
        options.page = page + 1;
        log(`Page ${page} of ${pages} retrieved`)
        log(`Total orders retrieved: ${results.length}`)
    }
    return results;
}

module.exports = async function main (startDate,log) {
    let orders = {
        orders: new Map(),
        items: [],
    };
    // convert startDate to ISO 8601 string
    startDate = new Date(startDate).toISOString();

    log("Getting orders new Orders from ShipStation");
    let newOrders = await getShipStationOrders({
        pageSize: 500,
        paymentDateStart: startDate,
    },log);
    log(`${newOrders.length} new orders retrieved`);


    log("Getting updated orders from ShipStation");
    let updatedOrders = await getShipStationOrders({
        pageSize: 500,
        modifyDateStart: startDate,
    })
    log(`${updatedOrders.length} updated orders retrieved`);

    log("Preparing the orders to be inserted in the database")
    updatedOrders
        .concat(newOrders)
        .forEach(order => {
            let orderId = order.orderId;
            if(!orders.orders.get(orderId)) {
                let paymentDate = new Date(order.paymentDate).toISOString();
                let orderStatus = order.orderStatus;
                let name = order['shipTo'].name.replaceAll("'", "");
                let storeId = order['advancedOptions'].storeId;
                orders.items.push(...order.items.map(item =>{
                    return {
                        orderId,
                        sku: item.sku,
                        quantitySold: item.quantity,
                        soldPrice: item.unitPrice,
                        name: item.name.replaceAll("'", ""),
                    }
                }));
                orders.orders.set(orderId, {
                    paymentDate,
                    orderId,
                    orderStatus,
                    name,
                    storeId,
                })
            }
        });
    log(`${orders.orders.size} orders to be inserted into the Orders database`);
    log(`${orders.items.length} items to be inserted into the Sales database`);

    for(let order of orders.orders.values()) {
        let {paymentDate, orderId, orderStatus, name, storeId} = order;
        let existingOrder = await db.query(`
            SELECT * FROM sursuite.orders WHERE order_id = '${orderId}';
        `);
        let query = "";
        let params = [orderId, paymentDate, orderStatus, name, storeId]
        if(existingOrder.rows.length === 0) {
            log("New Order");
            log("Inserting into the database")
            query =`
                INSERT INTO
                    sursuite.orders (order_id, payment_date_utc, order_status, name, store_id)
                VALUES
                    ($1, $2, $3, $4, $5);
            `
        }else{
            log("Existing Order");
            log("Updating the database")
            query=`
                UPDATE
                    sursuite.orders
                SET
                    payment_date_utc = $2,
                    order_status = $3,
                    name = $4,
                    store_id = $5
                WHERE
                    order_id = $1;
            `
        }
        await db.query(query, params);
    }

    for(let sale of orders.items){
        let {orderId, name, sku, quantitySold, soldPrice} = sale;
        if(sku === '') {
            sku = null
        }
        soldPrice = typeof soldPrice === "string" ? soldPrice.replace("$","") : soldPrice.toFixed(2);
        let existingSale = await db.query(`
            SELECT * FROM sursuite.sales WHERE order_id = '${orderId}' AND sku = '${sku}';
        `);
        let query = "";
        let params = [orderId, sku, name, quantitySold, soldPrice]
        if(existingSale.rows.length === 0) {
            log("New Sale");
            log("Inserting into the database")
            query =`
                INSERT INTO
                    sursuite.sales(order_id, sku, name, quantity_sold, sold_price)
                VALUES
                    ($1, $2, $3, $4, $5);
            `
        }else{
            log("Existing Sale");
            log("Updating the database")
            query=`
                UPDATE
                    sursuite.sales
                SET
                    name = $3,
                    quantity_sold = $4,
                    sold_price = $5
                WHERE
                    order_id = $1 AND sku = $2;
            `
        }

        try {
            await db.query(query, params);
        } catch (e) {
            log('Error updating the database');
            let fKeyVoilation = e.message.includes('violates foreign key constraint');
            if(!fKeyVoilation) {
                log(query,params)
                throw e;
            }
            log('Foreign Key Violation');
            log("Adding the component to the database");
            await db.query(`
                INSERT INTO 
                     sursuite.components (sku,title)
                VALUES
                     ($1, $2);
            `, [sku, name]);
            log("Component added to the database");
            log("attempting to update the database again");
            await db.query(query, params);
        }
    }

    log("Done updating the database with new orders from ShipStation");

}













