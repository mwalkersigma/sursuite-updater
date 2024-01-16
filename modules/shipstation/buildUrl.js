exports.buildURL = function buildURL(base_url, endpoint, options) {
    let url = new URL(base_url + endpoint);
    let temp = JSON.parse(JSON.stringify(options))
    Object
        .keys(temp)
        .forEach((key) => {
            url.searchParams.append(key, temp[key])
        })
    return url
}