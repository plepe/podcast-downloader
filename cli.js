#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')
const fs = require('fs')

const url = 'https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/'
const config = {
  parallelDownloads: 1
}

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

function generateFilenames (data, callback) {
  data.forEach(entry => {
    let m = entry.title.match(/^Folge ([0-9]*)\s*:?\s*([^\[]*)(\[.*|)$/)
    if (m) {
      entry.filename = m[1] + ' - ' + m[2].trim() + '.mp3'
    } else {
      console.error("Can't parse num + title from: " + entry.title)
    }
  })

  callback(null, data)
}

function downloadFiles (data, callback) {
  async.eachLimit(data, config.parallelDownloads, downloadFile, err => callback(err, data))
}

function downloadFile (entry, callback) {
  if (!entry.filename) {
    return callback(null)
  }

  let destFile = 'orig/' + entry.filename

  fs.stat(destFile,
   (err, data) => {
     if (!err) {
       console.error(entry.filename, 'exists')
       entry.file = destFile
       return callback(null, entry)
     }

     console.error("Downloading", entry.filename)
     fetch(entry.url)
       .then(response => response.buffer(),
         err => {
           console.error('error downloading', entry.filename)
         })
       .then(body => fs.writeFile(destFile, body,
         (err) => {
           if (err) { return done(err) }

	   entry.file = destFile
           callback(null, entry)
         })
       )
    }
  )
}

function printResult(data, callback) {
  console.log(JSON.stringify(data, null, '  '))
  callback(null)
}

async.waterfall(
  [
    parseListFromPage,
    useUrlAsFile,
    generateFilenames,
    downloadFiles,
    printResult
  ],
  err => {
    if (err) {
      console.error(err)
    }
  }
)
