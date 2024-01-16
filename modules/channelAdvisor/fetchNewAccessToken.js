function fetchNewAccessToken(applicationId, sharedSecret, refreshToken) {
    const authHeader = `Basic ${btoa(`${applicationId}:${sharedSecret}`)}`;
    const url = 'https://api.channeladvisor.com/oauth2/token';

    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);

    return fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    });
}