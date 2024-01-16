module.exports = function fetchWithBearerToken(url, bearerToken, options = {}) {
    const headers = options.headers || {};
    headers.Authorization = `Bearer ${bearerToken}`;
    options.headers = headers;

    return fetch(url, options);
};