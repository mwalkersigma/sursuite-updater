const fetchWithBearerToken = require("../fetchWithBearerToken");

module.exports = async function getProductId(skuValue,accessToken){
    
    const response = fetchWithBearerToken(`https://api.channeladvisor.com/v1/Products?$filter=Sku eq '${skuValue}'`, accessToken);

    if(!response.ok){
        throw new Error(`Failed to get product id for sku ${skuValue}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if(data?.value?.length === 0){
        throw new Error(`No product found for sku ${skuValue}`);
    }

    return data.value[0].ID;

}