#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')
const fs = require('fs')

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

      if (file) {
	const m = file.match(/\/([^/]+)$/)
	const filename = m[1]

	fetch(file)
	  .then(response => response.buffer())
	  .then(body => fs.writeFile('data/' + filename, body,
	    (err) => done(err, { title, file: 'data/' + filename })
	  ))
      } else {
	done(null, { title })
      }
    },
    (err, result) => console.log(JSON.stringify(result, null, '  ')))
  })
