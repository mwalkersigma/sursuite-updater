const fs = require("fs/promises")

async function createIfNotExists(path){
    // if the file does not exist, create it
    try{
        await fs.access(path);
    }catch (e) {
        await fs.writeFile(path,
            JSON.stringify({timeLastUpdated:{channelAdvisor:"2024-01-15",shipstation:"2024-01-15"}}, null, 2))
    }

}


exports.getLastUpdatedTime = async function getLastUpdatedTime(tokenName){
    await createIfNotExists("../../json/timeLastUpdated.json");
    const {timeLastUpdated} = await fs
        .readFile("../../json/timeLastUpdated.json", "utf-8")
        .then((data) => JSON.parse(data));

    return timeLastUpdated[tokenName];
}

exports.updateLastUpdatedTime = async function updateLastUpdatedTime(tokenName,value=new Date().toISOString()){
    await createIfNotExists("../../json/timeLastUpdated.json");
    let currentTimestampObject = await fs.readFile("../../json/timeLastUpdated.json", "utf-8")
        .then((data) => JSON.parse(data));
    currentTimestampObject.timeLastUpdated[tokenName] = value;
    await fs.writeFile("../../json/timeLastUpdated.json", JSON.stringify(currentTimestampObject, null, 2))
}