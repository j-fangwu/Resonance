const { WeaviateClient } = require('weaviate-client');

const client = WeaviateClient.client({
    scheme: 'http',
    host: 'localhost:8080',
});

module.exports = client;