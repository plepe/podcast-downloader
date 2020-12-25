#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM

fetch('https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/')
  .then(response => response.text())
  .then(body => {
    const dom = new JSDOM(body)
    const document = dom.window.document

    const list = document.querySelectorAll('.content > ul > li')
    const result = Array.from(list).map(entry => {
      const m = entry.textContent.match(/^(.*) Download/)
      const title = m ? m[1] : entry.textContent

      const links = entry.getElementsByTagName('a')
      const file = links.length >= 2 ? links[1].href : null

      return { title, file }
    })

    console.log(JSON.stringify(result, null, '  '))
  })
