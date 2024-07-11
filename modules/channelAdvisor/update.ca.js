const fetchWithBearerToken = require('../utils/fetchWithBearerToken.js');
const authorizeChannelAdvisor = require('./authorizeChannelAdvisor.js');
const {updateDB,insertDB} = require('./db.ca.js');
const componentDB = require('../Postgres/js/index.js');

const BASE_URL = "http://10.100.100.42:3005/"

function memoizedCall(){
    let cache = {};
    return async function(route){
        if(cache[route]){
            console.log("cache hit");
            return cache[route];
        }else{
            console.log("cache miss");
            cache[route] = await fetch(route).then((res) => res.json());
            return cache[route];
        }
    }
}

const generateDescription = (desc,attributes) => {
    return Object.keys(attributes).reduce((acc,curr)=>{
        if(!attributes[curr]) return acc;
        if(attributes[curr] === "" || attributes[curr] === null || attributes[curr] === undefined) return acc;
        acc += `||${curr}: ${attributes[curr]}`
        return acc;
    },desc.split("||")[0])
}


async function updateFromChannelAdvisor(lastUpdateDate,log){

    const { APPLICATION_ID, SHARED_SECRET, REFRESH_TOKEN } = process.env;

    let categoriesCache = memoizedCall();
    const categories = await fetch(BASE_URL).then((res) => res.json());

    log('Authorizing Channel Advisor...');
    const access_token = await authorizeChannelAdvisor(APPLICATION_ID, SHARED_SECRET, REFRESH_TOKEN);

    log('Channel Advisor Authorized!');

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
    let productCount = Products.size;
    log("finished getting newly created products");
    log(`finished parsing ${productCount} products`)

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
    log("finished getting newly updated products");
    log(`finished parsing ${Products.size - productCount} products`)

    Products = [...Products].map((product) => {
        try {
            return JSON.parse(product)
        } catch (e) {
            console.log(e);
            return null;
        }
    });

    log(`finished parsing ${Products.size} products`)

    for (let product of Products) {
        try {
            let productID = product?.['ID'];

            let attributesResponse = await fetchWithBearerToken(`https://api.channeladvisor.com/v1/Products(${productID})/Attributes`, access_token);
            let attributes = await attributesResponse.json();

            attributes = attributes.value.map((attribute) => ({ [attribute.Name]: attribute.Value }))
                .reduce((acc, attribute) => ({ ...acc, ...attribute }), {});



            product = { ...product, ...attributes };
            let dbComponent = await componentDB.query(`
                SELECT * FROM sursuite.components WHERE sku = $1
            `, [product?.['Sku']]).then((res) => res.rows);


            const category = product?.['Classification']

            if (categories.includes(category)) {
                let attributesForDescription = await categoriesCache(BASE_URL + category);
                attributesForDescription = attributesForDescription
                    .reduce((acc,cur)=>{
                        if(attributes[cur]){
                            acc[cur] = attributes[cur];
                        }
                        return acc;
                    },{})

                const generatedDesc = generateDescription(
                    product?.['Description'].split("||")[0],
                    attributesForDescription
                )

                if (generatedDesc !== product?.['Description']) {
                    log("Description does not match, updating...")
                    log(generatedDesc)
                    product['Description'] = generatedDesc;

                    await fetchWithBearerToken(
                        `https://api.channeladvisor.com/v1/Products(${productID})`,
                        access_token,
                        {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            Description: generatedDesc
                        })
                    })
                }


            }

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
                product?.['(21.) Image Last Updated Date'],
                product?.['(04.) Date of Final Approval'],
                product?.['(06.) Template Approval Status'],
                product?.['(09.) Series: Allen-Bradley Only'],
                product?.['(12.) Priced By'],
                product?.['(11.) Final Approval By'],
                product?.['(22.) Image Updated By'],
            ];

            log("---------------------------------------------------")
            log(`Sku: ${productValues[0]} - ${dbComponent.length ? '-> Updating' : 'Inserting'} into DB...`)
            log(`Brand : ${productValues[2]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.manufacturer}`}`)
            log(`Title : ${productValues[1]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.title}`}`)
            log(`Description : ${productValues[3]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.description}`}`)
            log(`BuyItNowPrice : ${productValues[4]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.['price']}`}`)
            log(`RetailPrice : ${productValues[5]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["retail_price"]}`}`)
            log(`Condition : ${productValues[6]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.condition}`}`)
            log(`Classification : ${productValues[7]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["category"]}`}`)
            log(`Weight : ${productValues[8]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.weight}`}`)
            log(`MPN : ${productValues[9]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["model"]}`}`)
            log(`CreateDateUtc : ${productValues[10]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["create_date_utc"]}`}`)
            log(`UpdateDateUtc : ${productValues[11]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["update_date_utc"]}`}`)
            log(`Date Priced : ${productValues[12]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["date_priced_utc"]}`}`)
            log(`Image Last Updated Date : ${productValues[13]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["image_last_updated_date_utc"]}`}`)
            log(`Date of Final Approval : ${productValues[14]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["final_approval_date_utc"]}`}`)
            log(`Template Approval Status : ${productValues[15]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["template_approval_status"]}`}`)
            log(`Series: Allen-Bradley Only : ${productValues[16]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["series"]}`}`)
            log(`Priced By : ${productValues[17]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["priced_by"]}`}`)
            log(`Final Approval By : ${productValues[18]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["final_approval_by"]}`}`)
            log(`Image Updated By : ${productValues[19]} ${dbComponent.length && `-> updating to ${dbComponent[0]?.["image_last_updated_by"]}`}`)
            log("---------------------------------------------------")

            if(!dbComponent.length){
                await insertDB(productValues);
            }else{
                await updateDB(productValues);
            }

        } catch (error) {

            log(error)

        }

    }

}

module.exports = updateFromChannelAdvisor