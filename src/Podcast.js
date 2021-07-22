const JSDOM = require('jsdom').JSDOM
const fetch = require('node-fetch')
const async = require('async')

const PodcastEpisode = require('./PodcastEpisode')
const listFiles = require('./listFiles')

module.exports = class Podcast {
  constructor (def, config) {
    this.def = def
    this.config = config
    this.list = []
  }

  loadExistingFiles (callback) {
    async.parallel(
      {
        downloaded: done => listFiles('orig/', done),
        normalized: done => listFiles('data/', done)
      },
      (err, { downloaded, normalized }) => {
        if (err) {
          return callback(err)
        }

        this.list.forEach(entry => {
          if (entry.id in downloaded) {
            entry.downloadedFile = 'orig/' + downloaded[entry.id].filename

            if (!entry.name) {
              entry.name = downloaded[entry.id].name
            }

            delete downloaded[entry.id]
          }

          if (entry.id in normalized) {
            entry.normalizedFile = 'data/' + normalized[entry.id].filename

            if (!entry.name) {
              entry.name = normalized[entry.id].name
            }

            delete normalized[entry.id]
          }
        })

        let add = []

        for (let id in downloaded) {
          const d = downloaded[id]

          d.downloadedFile = 'orig/' + d.filename

          if (id in normalized) {
            d.normalizedFile = 'data/' + normalized[id].filename
            delete normalized[id]
          }

          add.push(d)
        }

        for (let i in normalized) {
          const d = normalized[i]

          d.normalizedFile = 'data/' + d.filename

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
    async.waterfall(
      [
        done => this.parseListFromPage(done),
        //done => this.select(done),
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
