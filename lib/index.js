'use strict';

var es = require('elasticsearch');
var hoek = require('hoek');
var _ = require('lodash');
var util = require('util');

var HttpConnector = require('elasticsearch/src/lib/connectors/http');
var CustomHttpAgent = require('agentkeepalive');

function CustomESHTTPConnector(host, config) {
    HttpConnector.call(this, host, config);
}

util.inherits(CustomESHTTPConnector, HttpConnector);

CustomESHTTPConnector.prototype.createAgent = function (config) {   
    if(config.host.protocol === 'https') {
        return new CustomHttpAgent.HttpsAgent(this.makeAgentConfig(config));
    }
    return new CustomHttpAgent(this.makeAgentConfig(config));
};

var defaultSettings = {
    host: 'http://localhost:9200',
    log: require('./logger'),
    apiVersion: '2.2',
    connectionClass: CustomESHTTPConnector
};

exports.defaultElasticSettings = defaultSettings;

exports.Client = es.Client;
exports.errors = es.errors;

exports.register = function (server, opts, next) {
    var settings = hoek.applyToDefaults(defaultSettings, opts);
    server.log(['ent-elasticsearch', 'info'], 'Initializing elasticsearch connection with settings ' + JSON.stringify(settings));
    var client = new es.Client(settings);
    server.log(['ent-elasticsearch', 'info'], 'Created client');
    server.expose('client', client);
    server.expose('errors', es.errors);

    server.handler('es.search', function (route, options) {
        return function (request, reply) {
            var params = request.query;

            if (options.index) params.index = _.isFunction(options.index) ? options.index.call(null, request) : options.index;
            if (options.type) params.type = _.isFunction(options.type) ? options.type.call(null, request) : options.type;
            if (request.payload) params.body = request.payload;

            client.search(params, reply);
        };

    });

    server.expose('ensureIndexExists', function (index, options) {
        return client.indices.exists({ index: index })
            .then(function (exists) {
                return exists || client.indices.create({ index: index, body: options });
            });
    });

    server.log(['ent-elasticsearch', 'info'], 'Finished Initializing');

    next();
};

exports.register.attributes = {
    pkg: require('../package.json')
};