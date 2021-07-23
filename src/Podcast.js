const JSDOM = require('jsdom').JSDOM
const fetch = require('node-fetch')
const async = require('async')
const fs = require('fs')

const PodcastEpisode = require('./PodcastEpisode')
const listFiles = require('./listFiles')

module.exports = class Podcast {
  constructor (def, config) {
    this.def = def
    this.config = config
    this.list = []
  }

  pathDownloaded () {
    return this.def.id + '/downloaded/'
  }

  pathNormalized () {
    return this.def.id + '/normalized/'
  }

  createDirectories (callback) {
    async.parallel([
      done => fs.mkdir(this.pathDownloaded(), { recursive: true }, done),
      done => fs.mkdir(this.pathNormalized(), { recursive: true }, done)
    ], err => callback(err))
  }

  loadExistingFiles (callback) {
    async.parallel(
      {
        downloaded: done => listFiles(this.pathDownloaded(), done),
        normalized: done => listFiles(this.pathNormalized(), done)
      },
      (err, { downloaded, normalized }) => {
        if (err) {
          return callback(err)
        }

        this.list.forEach(entry => {
          if (entry.id in downloaded) {
            entry.downloadedFile = this.pathDownloaded() + downloaded[entry.id].filename

            if (!entry.name) {
              entry.name = downloaded[entry.id].name
            }

            delete downloaded[entry.id]
          }

          if (entry.id in normalized) {
            entry.normalizedFile = this.pathNormalized() + normalized[entry.id].filename

            if (!entry.name) {
              entry.name = normalized[entry.id].name
            }

            delete normalized[entry.id]
          }
        })

        const add = []

        for (const id in downloaded) {
          const d = downloaded[id]

          d.downloadedFile = this.pathDownloaded() + d.filename

          if (id in normalized) {
            d.normalizedFile = this.pathNormalized() + normalized[id].filename
            delete normalized[id]
          }

          add.push(d)
        }

        for (const i in normalized) {
          const d = normalized[i]

          d.normalizedFile = this.pathNormalized() + d.filename

          add.push(d)
        }

        async.each(
          add,
          (d, done) => {
            const episode = new PodcastEpisode(this)
            this.list.push(episode)
            episode.fromExisting(d, done)
          },
          callback
        )
      }
    )
  }

  parseListFromRss (callback) {
    fetch(this.def.url)
      .then(response => response.text())
      .then(body => {
        const dom = new JSDOM(body)
        const document = dom.window.document

        const list = document.querySelectorAll('rss > channel > item')

        async.eachOf(list,
          (entry, index, done) => {
            const episode = new PodcastEpisode(this)
            this.list.push(episode)

            episode.parseRssEntry(entry, list.length - index - 1, err => done(err))
          },
          (err) => {
            callback(err)
          }
        )
      })
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
    this.list = this.list.slice(0, 3)
    callback(null)
  }

  process (callback) {
    let parseFun

    switch (this.def.type) {
      case 'html':
        parseFun = this.parseListFromPage
        break
      case 'rss':
      default:
        parseFun = this.parseListFromRss
    }

    async.waterfall(
      [
        done => parseFun.call(this, done),
        done => this.createDirectories(done),
        // done => this.select(done),
        done => this.loadExistingFiles(done),
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
