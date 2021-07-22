#!/usr/bin/env node
const fetch = require('node-fetch')
const JSDOM = require('jsdom').JSDOM
const async = require('async')

const PodcastEpisode = require('./src/PodcastEpisode')

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
  parallelTasks: 4
}

function parseListFromPage (callback) {
  fetch(def.url)
    .then(response => response.text())
    .then(body => {
      const dom = new JSDOM(body)
      const document = dom.window.document

      const list = document.querySelectorAll(def.htmlQuerySelector)
      async.mapLimit(list, 4, (entry, done) => {
	const episode = new PodcastEpisode(def, config)

        episode.parseHtmlTitle(entry, err => done(err, episode))
      },
      callback)
    })
}

function printResult (list, callback) {
  async.map(list,
    (entry, done) => entry.printResult(done),
    (err, data) => {
      if (err) { return console.error(err) }
      console.log(JSON.stringify(data, null, '  '))
      callback(null)
    }
  )
}

function select (data, callback) {
  data = data.slice(0, 2)
  callback(null, data)
}

function debugAll (list, callback) {
  console.error(list)
  callback(null, list)
}

function processAll (list, callback) {
  async.eachLimit(
    list,
    config.parallelTasks,
    (entry, done) => entry.process(done),
    err => callback(err, list)
  )
}

async.waterfall(
  [
    parseListFromPage,
    select,
    processAll,
    debugAll,
//    generateFilenames,
//    downloadFiles,
//    normalizeFiles,
    printResult
  ],
  err => {
    if (err) {
      console.error(err)
    }
  }
)
