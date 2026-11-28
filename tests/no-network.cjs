// Test runs must never contact Supabase, storage, or any other network service.
const net = require('node:net')
const http = require('node:http')
const https = require('node:https')
const block = () => { throw new Error('Network access is disabled during tests; use mocks.') }
globalThis.fetch = async () => block()
net.connect = block
net.createConnection = block
net.Socket.prototype.connect = block
http.request = block
http.get = block
https.request = block
https.get = block
