#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')

const url = 'https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/'

function parseListFromPage (callback) {
  fetch(url)
    .then(response => response.text())
    .then(body => {
      const dom = new JSDOM(body)
      const document = dom.window.document

      const list = document.querySelectorAll('.content > ul > li')
      async.mapLimit(list, 4, (entry, done) => {
	const m = entry.textContent.match(/^(.*) Download/)
	const title = m ? m[1] : entry.textContent

	const links = entry.getElementsByTagName('a')
	const url = links.length >= 2 ? links[1].href : null

	done(null, { title, url })
      },
      callback)
    })
}

function useUrlAsFile (data, callback) {
  data.forEach(entry => entry.file = entry.url)
  callback(null, data)
}

function printResult(data, callback) {
  console.log(JSON.stringify(data, null, '  '))
  callback(null)
}

async.waterfall([
  parseListFromPage,
  useUrlAsFile,
  printResult
])
