#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')

fetch('https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/')
  .then(response => response.text())
  .then(body => {
    const dom = new JSDOM(body)
    const document = dom.window.document

    const list = document.querySelectorAll('.content > ul > li')
    async.mapLimit(list, 4, (entry, done) => {
      const m = entry.textContent.match(/^(.*) Download/)
      const title = m ? m[1] : entry.textContent

      const links = entry.getElementsByTagName('a')
      const file = links.length >= 2 ? links[1].href : null

      done(null, { title, file })
    },
    (err, result) => console.log(JSON.stringify(result, null, '  ')))
  })
