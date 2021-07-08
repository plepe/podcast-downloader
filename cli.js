#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')
const fs = require('fs')
const child_process = require('child_process')

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

	fs.stat('data/' + filename,
	  (err, data) => {
	    if (!err) {
	      console.log(filename, 'exists')
	      return done(null, { title, file: 'data/' + filename })
	    }

	    fetch(file)
	      .then(response => response.buffer(),
	        err => {
		  console.log('error downloading', filename)
		})
	      .then(body => fs.writeFile('/tmp/' + filename, body,
		(err) => {
		  if (err) { return done(err) }
		  normalize('/tmp/' + filename, 'data/' + filename,
		    (err) => {
		      console.log('err', err)
		      done(err, { title, file: 'data/' + filename })
		    }
		  )
		})
	      )
	  }
	)
      } else {
	done(null, { title })
      }
    },
    (err, result) => fs.writeFile('playlist.json', JSON.stringify(result, null, '  ')))
  })

function normalize (src, dest, callback) {
  console.log(callback)
  fs.stat(src,
    (err, data) => {
      if (err) {
	console.log(src, 'does not exists')
	return callback(null)
      }

      child_process.execFile('ffmpeg', [ '-i', src, '-filter:a', 'loudnorm', dest ], {}, (err) => {
	if (err) { console.error(err) }
	fs.unlink(src, () => {})
	callback(err)
      })
    }
  )
}
