/*!
 * Connect - DADI API Session Store
 * Copyright(c) 2019 James Lambie
 * MIT Licensed
 */

const ApiClient = require('./api')

module.exports = function (session) {
  const Store = session.Store

  class ApiStore extends Store {
    constructor (options = {}) {
      super(options)

      if (!options.host || !options.port) {
        throw new Error('API host and port must be provided')
      }

      this.options = options
      this.prefix = options.prefix == null ? 'sess:' : options.prefix
      this.ttl = (options.ttl || 86400 * 1000) // One day in seconds.
      this.disableTouch = options.disableTouch || false
    }

    _getData (key, session) {
      let value

      try {
        value = JSON.stringify(session)
      } catch (err) {
        throw err
      }

      return {
        expires: this._getExpiry(session),
        key,
        value
      }
    }

    _getExpiry (session) {
      if (session && session.cookie && session.cookie.expires) {
        return session.cookie.expires
      } else {
        return Date.now() + this.ttl
      }
    }

    _hasExpired (session) {
      let ms = new Date(session.expires).getTime() - Date.now()
      let ttl = Math.ceil(ms / 1000)

      return ttl <= 0
    }

    all (cb) {
      let prefixLen = this.prefix.length

      let query = this.getClient()
        .where({})
        .find()

      return query
        .then(({ results }) => {
          if (results.length === 0) {
            return cb(null, [])
          }

          let result
          try {
            result = results.map((result, index) => {
              const data = JSON.parse(result.value)
              data.key = result.key.substr(prefixLen)
              return data
            })

            return cb(null, result)
          } catch (err) {
            return cb(err)
          }
        })
        .catch(err => {
          return cb(err)
        })
    }

    clear (cb) {
      let query = this.getClient()
        .where({})
        .delete()

      return query
        .then(response => {
          return cb(null, response.deleted || 1)
        })
        .catch(err => {
          return cb(err)
        })
    }

    destroy (sid, cb) {
      let key = this.prefix + sid
      let query = this.getClient()
        .whereFieldIsEqualTo('key', key)
        .delete()

      return query
        .then(response => {
          return cb(null, response.deleted || 1)
        })
        .catch(err => {
          return cb(err)
        })
    }

    get (sid, cb) {
      let key = this.prefix + sid

      let query = this.getClient()
        .whereFieldIsEqualTo('key', key)
        .find()

      query
        .then(response => {
          if (!response.results || response.results.length === 0) {
            return cb()
          }

          let result = response.results[0]

          // Check key hasn't expired.
          if (this._hasExpired(result)) {
            return cb()
          }

          try {
            result = JSON.parse(result.value)
          } catch (err) {
            return cb(err)
          }

          return cb(null, result)
        })
        .catch(err => {
          return cb(err)
        })
    }

    getClient () {
      return ApiClient({
        host: this.options.host,
        port: this.options.port,
        property: this.options.property,
        version: this.options.version
      })
    }

    length (cb) {
      let query = this.getClient()
        .where({})
        .find()

      return query
        .then(({ metadata }) => {
          return cb(null, metadata.totalCount)
        })
        .catch(err => {
          return cb(err)
        })
    }

    set (sid, session, cb) {
      let data

      try {
        data = this._getData(this.prefix + sid, session)
      } catch (err) {
        return cb(err)
      }

      let query = this.getClient()
        .whereFieldIsEqualTo('key', data.key)
        .find()

      return query
        .then(({ results }) => {
          if (results.length > 0) {
            query = this.getClient()
              .whereFieldIsEqualTo('key', data.key)
              .update(data)
          } else {
            query = this.getClient().create(data)
          }

          return query
            .then(response => {
              return cb(null, response.results && response.results.length > 0)
            })
            .catch(err => {
              return cb(err)
            })
        })
        .catch(err => {
          return cb(err)
        })
    }

    touch (sid, session, cb) {
      if (this.disableTouch) {
        return cb()
      }

      return this.get(sid, (err, sessionData) => {
        if (err) {
          return cb(err)
        }

        let key = this.prefix + sid

        if (sessionData) {
          let data

          try {
            data = this._getData(key, session)
          } catch (err) {
            return cb(err)
          }

          let query = this.getClient()
            .whereFieldIsEqualTo('key', key)
            .update(data)

          return query
            .then(response => {
              return cb(null, response.results && response.results.length > 0)
            })
            .catch(err => {
              return cb(err)
            })
        }
      })
    }
  }

  return ApiStore
}
