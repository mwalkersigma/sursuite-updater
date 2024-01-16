module.exports = async function authorizeChannelAdvisor(APPLICATION_ID, SHARED_SECRET, REFRESH_TOKEN){
    const authURL = 'https://api.channeladvisor.com/oauth2/token';

    const authHeader = {
        "Authorization": `Basic ${btoa(`${APPLICATION_ID}:${SHARED_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const body = {
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN
    };

    const request = {
        method: 'POST',
        headers: authHeader,
        body: new URLSearchParams(body)
    };

    const response = await fetch(authURL, request);

    const data = await response.json();

    return data?.['access_token'];

}