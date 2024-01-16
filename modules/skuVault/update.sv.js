const componentDB = require('../Postgres/js/index.js');



const {
    SKU_VAULT_TENANT_TOKEN:TenantToken,
    SKU_VAULT_USER_TOKEN:UserToken,
} = process.env;

async function skuVaultUpdate (options) {
    const url = "https://app.skuvault.com/api/products/getProducts";
    console.log("Sku Vault" , "Start")
    console.log("Sku Vault" , "Options" , options)

    let headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        TenantToken,
        UserToken,
    }
    let body = JSON.stringify({
        ...{
            "IsReturnByCodes": false,
            "PageSize": 10000,
            TenantToken,
            UserToken,
        },
        ...options
    })

    let method  = "POST";
    let next = true;
    let pageNumber = 1;
    let inventory = {};
    do{
        body = JSON.stringify({...JSON.parse(body),...{PageNumber:pageNumber}});
        console.log("Starting Request" , pageNumber)
        const response = await fetch(url,{method,headers,body})
        console.log("Sku Vault" , response.status , response.statusText , pageNumber);
        if(response.ok) {
            const items = await response.json();
            if(items["Products"].length > 0) {
                pageNumber++;
                items["Products"].forEach((item) => inventory[item["Sku"]] = {quantity:item["QuantityAvailable"],cost:item["Cost"]});
            }else{
                next = false;
                break
            }
        }
    }while(next)

    Object.entries(inventory).forEach(([sku, {quantity,cost}]) => {
        console.log(sku,quantity,cost)
        // componentDB.query(`
        //     UPDATE sursuite.components
        //     SET
        //         quantity = $2,
        //         cost = $3
        //     WHERE sku = $1
        // `,[sku,quantity,cost])
    })



    console.log("Sku Vault" , "Done")
}


module.exports = async function (startDate) {
    await skuVaultUpdate({ModifiedAfterDateTimeUtc: new Date('2024-01-02').toISOString()});
}