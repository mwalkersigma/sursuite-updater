const fetchWithBearerToken = require('../utils/fetchWithBearerToken.js');
const authorizeChannelAdvisor = require('./authorizeChannelAdvisor.js');
const {updateDB,insertDB} = require('./db.ca.js');
const componentDB = require('../Postgres/js/index.js');
module.exports = async function updateFromChannelAdvisor(lastUpdateDate){

    const { APPLICATION_ID, SHARED_SECRET, REFRESH_TOKEN } = process.env;
    

    console.log('Authorizing Channel Advisor...');
    const access_token = await authorizeChannelAdvisor(APPLICATION_ID, SHARED_SECRET, REFRESH_TOKEN);
    console.log('Channel Advisor Authorized!');

    let Products = new Set();

    let newlyCreatedProductsResponse = await fetchWithBearerToken(`https://api.channeladvisor.com/v1/Products?$filter=CreateDateUtc ge ${lastUpdateDate}`, access_token);
    let newlyCreatedProducts = await newlyCreatedProductsResponse.json();

    while (newlyCreatedProducts['@odata.nextLink']) {
        console.log(newlyCreatedProducts['@odata.nextLink']);
        newlyCreatedProducts.value.forEach((product) => {
            Products.add(JSON.stringify(product))
        })
        
        newlyCreatedProductsResponse = await fetchWithBearerToken(newlyCreatedProducts['@odata.nextLink'], access_token);
        newlyCreatedProducts = await newlyCreatedProductsResponse.json();
    }

    let newlyUpdatedProductsResponse = await fetchWithBearerToken(`https://api.channeladvisor.com/v1/Products?$filter=UpdateDateUtc ge ${lastUpdateDate}`, access_token);
    let newlyUpdatedProducts = await newlyUpdatedProductsResponse.json();

    while (newlyUpdatedProducts['@odata.nextLink']) {
        console.log(newlyUpdatedProducts['@odata.nextLink']);
        newlyUpdatedProducts.value.forEach((product) => {
            Products.add(JSON.stringify(product))
        })
        newlyUpdatedProductsResponse = await fetchWithBearerToken(newlyUpdatedProducts['@odata.nextLink'], access_token)
        newlyUpdatedProducts = await newlyUpdatedProductsResponse.json()
    }
    console.log("finished getting newly updated products");

    Products = [...Products].map((product) => JSON.parse(product));

    console.log("finished parsing products")

    for (let product of Products) {
        try {
            let productID = product?.ID;

            let attributesResponse = await fetchWithBearerToken(`https://api.channeladvisor.com/v1/Products(${productID})/Attributes`, access_token);
            let attributes = await attributesResponse.json();

            attributes = attributes.value.map((attribute) => ({ [attribute.Name]: attribute.Value })).reduce((acc, attribute) => ({ ...acc, ...attribute }), {});

            product = { ...product, ...attributes };
            
            let dbComponent = await componentDB.query(`
                SELECT * FROM sursuite.components WHERE sku = $1
            `, [product?.['Sku']]).then((res) => res.rows);

            const productValues = [
                product?.['Sku'],
                product?.['Title'],
                product?.['Brand'],
                product?.['Description'],
                product?.['BuyItNowPrice'] ?? 0,
                product?.['RetailPrice'],
                product?.['(03.) Condition'],
                product?.['Classification'],
                product?.['Weight'] ?? 0,
                product?.['MPN'],
                product?.['CreateDateUtc'],
                product?.['UpdateDateUtc'],
                product?.['(13.) Date Priced'],
                product?.['ImageLastUpdateUtc'],
                product?.['(04.) Date of Final Approval'],
                product?.['(06.) Template Approval Status'],
                product?.['(09.) Series: Allen-Bradley Only'],
                product?.['(12.) Priced By'],
                product?.['(11.) Final Approval By'],
                product?.['(22.) Image Updated By'],
            ];

            if(!dbComponent.length){

                await insertDB(productValues);

            }else{

                await updateDB(productValues);

            }

        } catch (error) {

            console.log(error)

        }

    }

}