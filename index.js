/* jshint node: true */
'use strict';

var DeployPluginBase = require('ember-cli-deploy-plugin');
var publishSourcemap = require('@newrelic/publish-sourcemap').publishSourcemap;
var minimatch = require('minimatch');
var path = require('path');
var replaceExt = require('replace-ext');
var urljoin = require('url-join');

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

      didUpload: function(context) {
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
          }, (err) => {
            this.log(err || 'Source map upload done');
          });
        }
      }
    });

    return new DeployPlugin();
  }
};
