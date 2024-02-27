const {parse} = require("csv-parse");
const fs = require("fs");

const {PromisePool} = require("@supercharge/promise-pool")
// perf hooks
const shipStationToken = process.env.SHIPSTATION_TOKEN;

const db = require("../Postgres/js/index.js");
const {buildURL} = require("./buildUrl");



async function processCSV ( filePath,  callback ) {
    return new Promise((resolve, reject) =>{
        const parser = parse({
            delimiter: ",",
            relaxQuotes: true,
            relax_column_count: true,
        });
        fs.createReadStream(filePath, "utf8").pipe(parser);
        parser.on("readable", () => {
            let record;
            while (record = parser.read()) {
                callback(record);
            }
        });
        parser.on("end", () => {
            console.log("done");
            resolve()
        });
        parser.on("error", (err) => {
            reject(err);
        })
    })
}
async function processEbayCSV ( filePath ) {
    let headers;
    let results = [];
    await processCSV(filePath,(record) => {
        if (!headers) {
            headers = record.map(item => item.trim());
        } else {
            let obj = {};
            record.forEach((item, index) => {
                obj[headers[index]] = item;
            })
            results.push(obj);
        }
    })
    return results;
}
async function ebaySeed(filePath){
    let results = {orders:new Map(),items:[]};
    let orders = await processEbayCSV(filePath);
    orders.forEach(order => {
            let orderId = "E" + order["Sales Record Number"];
            if(!results.orders.get(orderId)) {
                let paymentDate = order["Paid On Date"]
                let orderStatus = "Shipped";
                let name = order["Buyer Username"];
                let storeId = "255895"
                results.orders.set( orderId, {
                    paymentDate,
                    orderId,
                    orderStatus,
                    name,
                    storeId,
                })
            }
            results.items.push({
                orderId,
                name: order["Item Title"].replaceAll("'",""),
                sku: order["Custom Label"],
                quantitySold: order["Quantity"],
                soldPrice: order["Sold For"],
            })
        })
    return results;
}

async function getShipStationOrders(options) {
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
        console.log(`Page ${page} of ${pages} retrieved`)
        console.log(`Total orders retrieved: ${results.length}`)
    }
    return results;
}

module.exports = async function main () {

    console.log("Getting ebay orders")
    let orders = await ebaySeed("./json/sales/eBay.csv");

    console.log("Getting historical orders")
    let bigCommerceOrders = await getShipStationOrders({
        pageSize: 500,
        paymentDateStart: "01-01-2020",
        storeId: 225004,
    });
    console.log("Finished getting orders from 2020-2023 for store 225004")
    console.log("Getting orders from june 2023 to present")

    let newOrders = await getShipStationOrders({
        pageSize: 500,
        paymentDateStart: "06-01-2023",
        storeId: 225895,
    })

    bigCommerceOrders
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
        })



    let queries = [];
    console.log("Starting orders")
    orders.orders.forEach(order => {
        let {paymentDate, orderId, orderStatus, name, storeId} = order;
        queries.push(`
            INSERT INTO
                sursuite.orders (order_id, payment_date_utc, order_status, name, store_id)
            VALUES
                ( '${orderId}', '${paymentDate}', '${orderStatus}', '${name}', '${storeId}');
        `)
    });
    console.log("Finished processing orders")
    console.log("Starting insert")
    let {results:r1} = await PromisePool
        .for(queries)
        .withConcurrency(250)
        .process(async (query) => {
            console.log(query)
            console.log("Starting query")
            return await db.query(query);
        });
    console.log("Starting items");
    console.log(r1);
    queries = [];
    orders.items.forEach(item => {
        let {orderId, name, sku, quantitySold, soldPrice} = item;
        soldPrice = typeof soldPrice === "string" ? soldPrice.replace("$","") : soldPrice.toFixed(2);
        queries.push(`
            INSERT INTO 
                sursuite.sales(order_id, sku, name, quantity_sold, sold_price)
            VALUES 
                ( '${orderId}', '${sku}', '${name}', ${quantitySold}, ${soldPrice});
        `)
    });
    console.log("finished processing items")
    console.log("Starting insert")
    let {results:r2} = await PromisePool
        .for(queries)
        .withConcurrency(5)
        .process(async (query) => {
            console.log(query)
            console.log("Starting query")
            let result = await db.query(query);
            console.log("Finished query")
            return result;
        });
    console.log(r2)

}













