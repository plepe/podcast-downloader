#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')
const fs = require('fs')
const child_process = require('child_process')

const url = 'https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/'
const config = {
  parallelDownloads: 1,
  parallelNormalizers: 4
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

function normalizeFiles (data, callback) {
  async.eachLimit(data, config.parallelNormalizers, normalizeFile, err => callback(err, data))
}

function normalizeFile (entry, callback) {
  let srcFile = 'orig/' + entry.filename
  let destFile = 'data/' + entry.filename

  async.parallel(
    {
      srcStat: done => fs.stat(srcFile, (err, result) => {
	done(null, result)
      }),
      destStat: done => fs.stat(destFile, (err, result) => {
	if (err) {
	 return done(null)
	}

	done(err, result)
      })
    },
    (err, { srcStat, destStat }) => {
      if (err) {
	console.error(err)
        return callback(null)
      }

      if (!srcStat || destStat) {
	return callback(null)
      }

      console.error("Normalizing", entry.filename)
      child_process.execFile('ffmpeg', [ '-i', srcFile, '-filter:a', 'loudnorm', '-y', destFile ], {}, (err) => {
        if (err) { console.error(err) }
        entry.file = destFile

        callback()
      })
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
    normalizeFiles,
    printResult
  ],
  err => {
    if (err) {
      console.error(err)
    }
  }
)
