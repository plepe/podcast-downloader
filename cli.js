#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')
const fs = require('fs')
const child_process = require('child_process')

const def = {
  type: 'html',
  url: 'https://scienceblogs.de/astrodicticum-simplex/sternengeschichten/',
  htmlQuerySelector: '.content > ul > li',
  htmlIdRegexp: /^Folge ([0-9]*)/,
  htmlNameRegexp: /^Folge (?:[0-9]*)\s*:?\s*([^\[]+)\s*(Download)/,
  htmlTitleRegexp: /^(Folge (?:[0-9]*)\s*:?\s*([^\[]+))\s*(Download)/,
  htmlUseLinkNum: 1
}

const config = {
  parallelDownloads: 1,
  parallelNormalizers: 4
}

function parseListFromPage (callback) {
  fetch(def.url)
    .then(response => response.text())
    .then(body => {
      const dom = new JSDOM(body)
      const document = dom.window.document

      const list = document.querySelectorAll(def.htmlQuerySelector)
      async.mapLimit(list, 4, (entry, done) => {
	d = {}

        d.htmlTitle = entry.textContent

	let m = entry.textContent.match(def.htmlTitleRegexp)
	d.title = (m ? m[1] : entry.textContent).trim()

	m = entry.textContent.match(def.htmlIdRegexp)
	d.id = m ? m[1].trim() : null

	m = entry.textContent.match(def.htmlNameRegexp)
	d.name = m ? m[1].trim() : null

	const links = entry.getElementsByTagName('a')
	d.url = links.length > def.htmlUseLinkNum ? links[def.htmlUseLinkNum].href : null

	done(null, d)
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
    entry.filename = entry.id + ' - ' + entry.name + '.mp3'
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

  const destFile = 'orig/' + entry.filename

  fs.stat(destFile,
   (err, data) => {
     if (!err) {
       console.error(entry.filename, 'exists')
       entry.file = destFile
       entry.downloadFile = destFile
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
           if (err) { return callback(err) }

	   entry.file = destFile
	   entry.downloadFile = destFile
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
  const destFile = 'data/' + entry.filename

  async.parallel(
    {
      srcStat: done => fs.stat(entry.downloadFile, (err, result) => {
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
        entry.normalizedFile = destFile
        entry.file = destFile
	return callback(null)
      }

      console.error("Normalizing", entry.filename)
      child_process.execFile('ffmpeg', [ '-i', entry.downloadFile, '-filter:a', 'loudnorm', '-y', destFile ], {}, (err) => {
        if (err) { console.error(err) }
        entry.file = destFile
        entry.normalizedFile = destFile

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
