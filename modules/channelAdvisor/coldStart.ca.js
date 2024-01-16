const {getInventoryExport} = require('../channelAdvisor/getInventoryExport')
const {insertDB} = require("../channelAdvisor/db.ca")

const fs = require('fs');
const fsp = require('fs/promises');
const Downloader = require("nodejs-file-downloader");
const decompress = require('decompress');
const {parse} = require('csv-parse');
const {PromisePool} = require("@supercharge/promise-pool");







async function getFileResponseURL(){
    let fileResponseUrl = null;
    do{
        let response = await getInventoryExport();
        fileResponseUrl = response['FileResponseURL'];
        if(!fileResponseUrl){
            console.log("Waiting for file response url");
            await new Promise((resolve,reject) => setTimeout(resolve,1000));
        }
    }while(!fileResponseUrl);
    return fileResponseUrl;
}

async function downloadFile(fileResponseURL){
    const {access_token} = await fsp
        .readFile("./src/json/access_token.json")
        .then(JSON.parse);

    console.log("Starting download of file");

    const downloader = new Downloader({
        url: fileResponseURL,
        directory: "./src/json/outputs",
        headers:{
            'Authorization': `Bearer ${access_token}`,
        }
    });
    try{
        await downloader.download();
    }catch (error){
        console.log(error);
    }
    console.log("Finished download of file");
};

function parseRecordForComponentTable(record){
    return ([
        String(record[5]),
        String(record[4]),
        String(record[46]),
        String(record[37]),
        Number(record[51]),
        Number(record[52]),
        String(record[47]),
        String(record[79]),
        Number(record[30]),
        String(record[35]),
        new Date(record[18]).toUTCString(),
        new Date(record[19]).toUTCString(),
        record[105] || null,
        record[119] || null,
        record[89] || null,
        String(record[91]),
        String(record[97]),
        String(record[103]),
        String(record[101]),
        String(record[121]),
    ])
}



module.exports = async function channelAdvisorColdStart(){
    console.log("Starting Channel Advisor Cold Start");
    let fileResponseURL = await getFileResponseURL();
    await downloadFile(fileResponseURL);

    let outputFolder = "./json/outputs";
    let outputFiles = await fsp.readdir(outputFolder);
    let file = outputFiles[0];

    console.log("Unzipping file");
    await decompress(`${outputFolder}/${file}`,outputFolder);
    console.log("Finished unzipping file");

    let records = [];
    console.log("Starting parsing file")
    await new Promise((resolve,reject) =>{
        let toggle = false;
        const parser = parse({
            delimiter: '\t',
        });
        fs
            .createReadStream(`${outputFolder}/${file.split(".")[0]}.txt`)
            .pipe(parser);
        parser.on('readable', function(){
            let record;
            while ((record = parser.read()) !== null) {
                if(!toggle && records.length === 0){
                    toggle = true;
                    continue;
                }
                records.push(parseRecordForComponentTable(record));
            }
        });
        parser.on('error', function(err){
            console.error(err.message)
            reject(err)
        })
        parser.on('end', function(){
            console.log('done parsing TSV')
            console.log(records.length)
            resolve()
        })
    });
    console.log("Finished parsing file");
    console.log(records.length)
    console.log("Starting database update");

    const promisePool = await PromisePool
        .for(records)
        .withConcurrency(25)
        .process(insertDB);

    console.log("Finished database update");
    console.log("Finished Channel Advisor Cold Start");
    console.log(promisePool)


}