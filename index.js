/* jshint node: true */
'use strict';

var DeployPluginBase = require('ember-cli-deploy-plugin');
var minimatch = require('minimatch');
var path = require('path');
var replaceExt = require('replace-ext');
var superagent = require('superagent')
var urljoin = require('url-join');

function publishSourcemap(options, cb) {
  var sourcemapPath = options.sourcemapPath;
  var javascriptUrl = options.javascriptUrl;
  var nrAdminKey = options.nrAdminKey;
  var releaseId = options.releaseId;
  var releaseName = options.releaseName;
  var applicationId = options.applicationId;
  var sourcemapUploadHost = options.sourcemapUploadHost || 'https://sourcemaps.service.newrelic.com';
  var sourcemapUploadPath = sourcemapUploadHost + '/v2/applications/' + applicationId + '/sourcemaps';
  var callback = cb || function () { };

  var request = superagent
    .post(sourcemapUploadPath)
    .attach('sourcemap', sourcemapPath)
    .field('javascriptUrl', javascriptUrl)
    .field('source', 'client-module')
    .set('NEWRELIC-API-KEY', nrAdminKey);

  if (releaseName && releaseId) {
    request = request.field('releaseName', releaseName);
    request = request.field('releaseId', releaseId);
  }

  request
    .end(function (err, httpResponse) {
      if (err && err.status != 409) {
        return callback(err);
      }

      return callback(null, httpResponse.body);
    });
};

module.exports = {
  name: 'ember-cli-deploy-newrelic-sourcemaps',

  included: function(app) {
    app.options['sourcemaps'] = {
      enabled: true
    };

    this._super.included.apply(this, arguments);
  },

  createDeployPlugin: function(options) {
    let DeployPlugin = DeployPluginBase.extend({
      name: options.name,

      defaultConfig: {
        filePattern: '**/*.map',
        newrelicAPIKey: process.env.NEWRELIC_API_KEY,
        newrelicAppID: process.env.NEWRELIC_APP_ID,
        distFiles: function(context) {
          return context.distFiles;
        },
        distDir: function(context) {
          return context.distDir;
        }
      },

      requiredConfig: ['hostname'],

      didBuild: function(context) {
        const distFiles = this.readConfig('distFiles');
        const distDir = this.readConfig('distDir');
        const filePattern = this.readConfig('filePattern');
        const hostname = this.readConfig('hostname');

        const sourcemaps = distFiles.filter(minimatch.filter(filePattern, {
          matchBase: true
        }));

        if (sourcemaps.length === 0) {
          this.log('no sourcemaps found');
        }

        for(let i = 0; i < sourcemaps.length; i++) {
          let mapFilePath = path.join(distDir, sourcemaps[i]);
          let hostURL = urljoin(
            hostname,
            replaceExt(sourcemaps[i], '.js')
          );

          publishSourcemap({
            sourcemapPath: mapFilePath,
            javascriptUrl: hostURL,
            applicationId: this.readConfig('newrelicAppID'),
            nrAdminKey: this.readConfig('newrelicAPIKey'),
          }, (err, response) => {
            this.log(err || 'Source map upload done');
          });
          
        }
      }
    });

    return new DeployPlugin();
  }
};
