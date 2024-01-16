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

const fs = require("fs/promises")

const channelAdvisor = require('./modules/channelAdvisor/update.ca');
const shipstation = require('./modules/shipstation/update.ss');

async function createIfNotExists(path){
    // if the file does not exist, create it
    try{
        await fs.access(path);
    }catch (e) {
        await fs.writeFile(path,
            JSON.stringify({timeLastUpdated:{channelAdvisor:"2024-01-15",shipstation:"2024-01-15"}}, null, 2))
    }

}


async function getLastUpdatedTime(tokenName){
    await createIfNotExists("./json/timeLastUpdated.json");
    const {timeLastUpdated} = await fs
        .readFile("./json/timeLastUpdated.json", "utf-8")
        .then((data) => JSON.parse(data));

    return timeLastUpdated[tokenName];
}

async function updateLastUpdatedTime(tokenName,value=new Date().toISOString()){
    await createIfNotExists("./json/timeLastUpdated.json");
    let currentTimestampObject = await fs.readFile("./json/timeLastUpdated.json", "utf-8")
        .then((data) => JSON.parse(data));
    currentTimestampObject.timeLastUpdated[tokenName] = value;
    await fs.writeFile("./json/timeLastUpdated.json", JSON.stringify(currentTimestampObject, null, 2))
}

(async () => {
    let lastUpdateDate = await getLastUpdatedTime("channelAdvisor");
    console.log(lastUpdateDate);
    await channelAdvisor(lastUpdateDate);
    await updateLastUpdatedTime("channelAdvisor");
    lastUpdateDate = await getLastUpdatedTime("shipstation");
    await shipstation(lastUpdateDate);
    await updateLastUpdatedTime("shipstation");
})()