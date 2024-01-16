const channelAdvisor = require('./modules/channelAdvisor/coldStart.ca');
const shipstation = require('./modules/shipstation/coldStart.ss');
const skuVault = require('./modules/skuVault/coldStart.sv');

async function coldStart () {
    await channelAdvisor();
    await shipstation();
    await skuVault();
}

module.exports = {
    coldStart,
}
