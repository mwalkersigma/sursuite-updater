const authorizeChannelAdvisor = require('./authorizeChannelAdvisor.js');



module.getInventoryExport =  async function getInventoryExport(){
    let channelAdvisorTokens = await fsp.readFile("./src/json/access_token.json").then(JSON.parse);
    let {time,access_token,export_token} = {...channelAdvisorTokens};
    const now = new Date();

    if(!access_token){
        const newAccessToken = await authorizeChannelAdvisor();
        time = now;
        access_token = newAccessToken;
        export_token = "";
    }

    const timeSinceLastAuth = now - new Date(time);
    const oneHour = 1000 * 60 * 60;

    if(timeSinceLastAuth > oneHour){
        // If the token is more than an hour old, we need to get a new one.
        const newAccessToken = await authorizeChannelAdvisor();
        time = now;
        access_token = newAccessToken;
        export_token = "";
    }

    let baseURL = 'https://api.channeladvisor.com/v1/ProductExport/attr:(RetailPrice)';
    let searchParams = `?access_token=${access_token}`;
    
    const headers = {
        "Authorization": `Bearer ${access_token}`,
    }

    const request = {
        headers,
    }

    if(export_token){
        request.method = 'GET';
        searchParams += `&token=${export_token}`;
    }else{
        request.method = 'POST';
    }

    const response = await fetch(baseURL + searchParams);
    const data = await response.json();
    const token = data['Token'];

    if(!export_token){

        export_token = token;
        fs.writeFileSync("./src/json/access_token.json",JSON.stringify({time,access_token,export_token}));

    }

    return data;
};