const {getLastUpdatedTime, updateLastUpdatedTime} = require("./modules/utils/updateTime");
const skuVault = require("./modules/skuVault/update.sv");



(async () => {
    let lastUpdateDate = await getLastUpdatedTime("skuVault");
    await skuVault(lastUpdateDate);
    await updateLastUpdatedTime("skuVault");
})()
