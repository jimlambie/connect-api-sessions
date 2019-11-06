require('isomorphic-fetch')
const APIWrapper = require('@dadi/api-wrapper-core')

const ApiClient = function ({
  host,
  port,
  property,
  version,
  collection = 'sessions',
  fields = []
}) {
  if (!host) {
    throw new Error('ApiClient: Missing API configuration')
  }

  // Add additional headers to the RequestObject returned from
  // the API Wrapper, before executing the query against the API.
  const apiRequestCallback = requestObject => {
    const augmentedRequestObject = Object.assign({}, requestObject, {})
    return executeRequest(augmentedRequestObject)
  }

  const executeRequest = query => {
    return apiFetch(query)
      .then(response => {
        return response
      })
      .catch(err => {
        return Promise.reject(err)
      })
  }

  // Create the API Wrapper instance to pass back
  // to the calling function.
  const apiWrapperOptions = {
    callback: apiRequestCallback,
    port,
    property,
    uri: host,
    version
  }

  let apiInstance = new APIWrapper(apiWrapperOptions)
    .inProperty(property)
    .useFields(fields)
    .in(collection)

  return apiInstance
}

const apiFetch = function (requestObject) {
  return fetch(requestObject.uri.href, {
    body: JSON.stringify(requestObject.body),
    headers: Object.assign({}, requestObject.headers, {
      'Content-Type': 'application/json'
    }),
    method: requestObject.method
  }).then(response => {
    if (response.status === 204) {
      return null
    }

    if (response.ok) {
      return response.json()
    }

    if (response.status === 404) {
      return Promise.reject(new Error('404'))
    }

    return response.json().then(error => {
      return Promise.reject(error)
    })
  })
}

module.exports = ApiClient
