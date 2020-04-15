'use strict'

const { promisify } = require('util')
const { post } = require('request')
const postAsync = promisify(post)
const { promClientJsonToInfluxV2 } = require('./metrics/format-converters')
const log = require('./log')

module.exports = class InfluxMetrics {
  constructor(metricInstance, instanceMetadata, config) {
    this._metricInstance = metricInstance
    this._instanceMetadata = instanceMetadata
    this._config = config
  }

  async sendMetrics() {
    const auth = {
      user: this._config.username,
      pass: this._config.password,
    }
    const request = {
      uri: this._config.url,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.metrics(),
      timeout: this._config.timeoutMillseconds,
      auth,
    }

    let response
    try {
      response = await postAsync(request)
    } catch (error) {
      log.error(
        new Error(`Cannot push metrics. Cause: ${error.name}: ${error.message}`)
      )
    }
    if (response && response.statusCode >= 300) {
      log.error(
        new Error(
          `Cannot push metrics. ${response.request.href} responded with status code ${response.statusCode}`
        )
      )
    }
  }

  startPushingMetrics() {
    this._intervalId = setInterval(
      () => this.sendMetrics(),
      this._config.intervalSeconds * 1000
    )
  }

  metrics() {
    return promClientJsonToInfluxV2(this._metricInstance.metrics(), {
      env: this._instanceMetadata.env,
      application: 'shields',
      instance: this._config.hostnameAsAnInstanceId
        ? this._instanceMetadata.hostname
        : this._instanceMetadata.id,
    })
  }

  stopPushingMetrics() {
    if (this._intervalId) {
      clearInterval(this._intervalId)
      this._intervalId = undefined
    }
  }
}
