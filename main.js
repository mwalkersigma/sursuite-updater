/*
********************************************************************
Name : Sursuite Updater
Author : Michael Walker
Date : 1/11/24
Description : 
This application / script updates the sursuite Database with a predefined frequency and when the application is run.
There is also a method for a cold start, which will update the database with all the data from the beginning of the
sursuite project. Including re-creating the database.
********************************************************************
*/
require('dotenv').config();



const channelAdvisor = require('./modules/channelAdvisor/update.ca');
const shipStation = require('./modules/shipstation/update.ss');

const { getLastUpdatedTime, updateLastUpdatedTime } = require("./modules/utils/updateTime");

(async () => {
    const {default:Logger} = await import("sigma-logger")
    const log = (msg) => Logger.log(msg);

    let lastUpdateDate = await getLastUpdatedTime("channelAdvisor");
    await channelAdvisor(lastUpdateDate,log);
    await updateLastUpdatedTime("channelAdvisor");

    // log(lastUpdateDate);
    //
    // lastUpdateDate = await getLastUpdatedTime("shipstation");
    // await shipStation(lastUpdateDate,log);
    // await updateLastUpdatedTime("shipstation");

})()