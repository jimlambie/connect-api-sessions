const api = require('./api')
const session = require('express-session')
const test = require('blue-tape')

const commands = [
  { emoji: '🦄', name: 'unicorn' },
  { emoji: '🍕', name: 'pizza' },
  { emoji: '🍺', name: 'beer' },
  { emoji: '🔥', name: 'err' },
  { emoji: '👍🏻', name: 'ok' }
]

commands.forEach(({ name, emoji }) => {
  console[name] = (...args) => console.log(emoji + ' ' + args.join(', '))
})

let ApiStore = require('../')(session)

let p = (ctx, method) => (...args) =>
  new Promise((resolve, reject) => {
    ctx[method](...args, (err, d) => {
      if (err) reject(err)
      resolve(d)
    })
  })

test('setup', t => {
  api
    .start()
    .then(() => {
      console.pizza('Test API running')

      t.end()
    })
})

test('defaults', async t => {
  t.throws(() => new ApiStore(), 'API host and port must be provided')

  const options = {
    host: 'http://localhost',
    port: 3004,
    property: 'test',
    version: '1.0'
  }

  var store = new ApiStore(options)

  t.equal(store.options, options, 'options')
  t.equal(store.prefix, 'sess:', 'defaults to sess:')
  t.equal(store.ttl, 86400000, 'defaults to one day')
  t.equal(store.disableTouch, false, 'defaults to having `touch` enabled')
})

test('api lifecycle', async t => {
  var store = new ApiStore({
    host: 'http://localhost',
    port: 3004,
    property: 'test',
    version: '1.0'
  })

  await lifecycleTest(store, t)
})

test('teardown', t => {
  return api.stop().then(() => {
    console.unicorn('Test API stopped')

    t.end()
    process.exit(0)
  })
})

async function wait () {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('wait')
      return resolve()
    }, 2000)
  })
}

async function lifecycleTest (store, t) {
  let res = await p(store, 'set')('123', { foo: 'bar' })
  t.equal(res, true, 'set value')

  res = await p(store, 'get')('123')
  t.same(res, { foo: 'bar' }, 'get value')

  let ttl = 60
  let expires = new Date(Date.now() + ttl * 1000).toISOString()

  res = await p(store, 'set')('456', { cookie: { expires } })
  t.equal(res, true, 'set cookie expires')

  ttl = 90
  let newExpires = new Date(Date.now() + ttl * 1000).toISOString()

  res = await p(store, 'touch')('456', { cookie: { expires: newExpires } })
  t.equal(res, true, 'set cookie expires touch')

  ttl = 1
  newExpires = new Date(Date.now() + ttl * 1000).toISOString()
  res = await p(store, 'touch')('456', { cookie: { expires: newExpires } })

  await wait()

  res = await p(store, 'get')('456')
  t.equal(res, undefined, 'get expired value')

  res = await p(store, 'length')()
  t.equal(res, 2, 'stored two keys length')

  res = await p(store, 'all')()
  res.sort((a, b) => (a.key > b.key ? 1 : -1))
  res = res.map(item => {
    return { key: item.key }
  })
  t.same(res, [{ key: '123' }, { key: '456' }], 'stored two keys data')

  res = await p(store, 'destroy')('456')
  t.equal(res, 1, 'destroyed one')

  res = await p(store, 'length')()
  t.equal(res, 1, 'one key remains')

  res = await p(store, 'clear')()
  t.equal(res, 1, 'cleared remaining key')

  res = await p(store, 'length')()
  t.equal(res, 0, 'no key remains')

  let count = 1000
  await load(store, count)

  res = await p(store, 'length')()
  t.equal(res, count, 'bulk count')

  res = await p(store, 'clear')()
  t.equal(res, count, 'bulk clear')
}

function load (store, count) {
  return new Promise((resolve, reject) => {
    let set = sid => {
      store.set(
        's' + sid,
        {
          cookie: { expires: new Date(Date.now() + 1000) },
          data: 'some data'
        },
        err => {
          if (err) {
            return reject(err)
          }

          if (sid === count) {
            return resolve()
          }

          set(sid + 1)
        }
      )
    }
    set(1)
  })
}
