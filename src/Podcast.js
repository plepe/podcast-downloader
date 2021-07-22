const JSDOM = require('jsdom').JSDOM
const fetch = require('node-fetch')
const async = require('async')

const PodcastEpisode = require('./PodcastEpisode')

module.exports = class Podcast {
  constructor (def, config) {
    this.def = def
    this.config = config
    this.list = []
  }

  parseListFromPage (callback) {
    fetch(this.def.url)
      .then(response => response.text())
      .then(body => {
        const dom = new JSDOM(body)
        const document = dom.window.document

        const list = document.querySelectorAll(this.def.htmlQuerySelector)
        async.eachLimit(list, 4, (entry, done) => {
          const episode = new PodcastEpisode(this)
          this.list.push(episode)

          episode.parseHtmlTitle(entry, err => done(err))
        },
        (err) => {
          callback(err)
        })
      })
  }

  printResult (callback) {
    async.map(this.list,
      (entry, done) => entry.printResult(done),
      (err, data) => {
        if (err) { return console.error(err) }
        console.log(JSON.stringify(data, null, '  '))
        callback(null)
      }
    )
  }

  processAll (callback) {
    async.eachLimit(
      this.list,
      this.config.parallelTasks,
      (entry, done) => entry.process(done),
      err => callback(err)
    )
  }

  select (callback) {
    this.list = this.list.slice(0, 2)
    callback(null)
  }

  process (callback) {
    async.waterfall(
      [
        done => this.parseListFromPage(done),
        done => this.select(done),
        done => this.processAll(done),
        done => this.printResult(done)
      ],
      err => {
        if (err) {
          console.error(err)
        }
      }
    )
  }
}
