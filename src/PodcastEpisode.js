const fetch = require('node-fetch')
const async = require('async')
const fs = require('fs')
const childProcess = require('child_process')

const strReplacer = {
  '\\?': '',
  ':': ' -',
  '<': '',
  '>': '',
  '/': '-',
  '\\+': '',
  '\\\\': '-',
  '\\|': '-',
  '\\*': ''
}

module.exports = class PodcastEpisode {
  constructor (podcast) {
    this.podcast = podcast
  }

  parseHtmlTitle (dom, callback) {
    this.htmlTitle = dom.textContent

    let m = dom.textContent.match(this.podcast.def.htmlTitleRegexp)
    this.title = (m ? m[1] : dom.textContent).trim()

    m = dom.textContent.match(this.podcast.def.htmlIdRegexp)
    this.id = m ? m[1].trim() : null

    m = dom.textContent.match(this.podcast.def.htmlNameRegexp)
    this.name = m ? m[1].trim() : null

    const links = dom.getElementsByTagName('a')
    this.url = links.length > this.podcast.def.htmlUseLinkNum ? links[this.podcast.def.htmlUseLinkNum].href : null

    callback()
  }

  parseRssEntry (dom, revIndex, callback) {
    this.htmlTitle = dom.querySelector(':scope > title').textContent

    this.title = this.htmlTitle

    this.name = this.htmlTitle

    this.id = revIndex + 1

    this.url = dom.querySelector(':scope > enclosure').getAttribute('url')

    callback()
  }

  fromExisting (data, callback) {
    for (const k in data) {
      this[k] = data[k]
    }

    if (!this.title) {
      this.title = 'Folge ' + this.id + ': ' + this.name
    }

    callback()
  }

  renameExistingFiles (callback) {
    async.parallel(
      [
        done => {
          const file = this.podcast.pathDownloaded() + this.filename
          if (this.downloadedFile && this.downloadedFile !== file) {
            fs.rename(this.downloadedFile, file, done)
            this.downloadedFile = file
          } else {
            done()
          }
        },
        done => {
          const file = this.podcast.pathNormalized() + this.filename
          if (this.normalizedFile && this.normalizedFile !== file) {
            fs.rename(this.normalizedFile, file, done)
            this.normalizedFile = file
          } else {
            done()
          }
        }
      ],
      err => callback(err)
    )
  }

  useUrlAsFile (callback) {
    this.file = this.url
    callback()
  }

  generateFilename (callback) {
    this.filename = this.id + ' - ' + this.name + '.mp3'

    for (const k in strReplacer) {
      this.filename = this.filename.replace(new RegExp(k, 'g'), strReplacer[k])
    }

    callback()
  }

  downloadFile (callback) {
    if (!this.filename) {
      console.error(this.id, 'no filename -> skip')
      return callback(null)
    }

    if (this.downloadedFile) {
      console.error(this.id, this.filename, 'exists')
      this.file = this.downloadedFile
      return callback(null)
    }

    const destFile = this.podcast.pathDownloaded() + this.filename

    console.error(this.id, 'Downloading', this.filename)

    fetch(this.url)
      .then(response => response.buffer(),
        err => {
          console.error('error downloading', this.filename, err)
        })
      .then(body => fs.writeFile(destFile, body,
        (err) => {
          if (err) { return callback(err) }

          this.file = destFile
          this.downloadedFile = destFile
          callback(null)
        })
      )
  }

  normalizeFile (callback) {
    const destFile = this.podcast.pathNormalized() + this.filename

    if (this.normalizedFile) {
      console.error(this.id, this.filename, 'exists')
      this.file = this.normalizedFile
      return callback(null)
    }

    if (!this.downloadedFile) {
      console.error(this.id, this.filename, 'not downloaded')
      return callback(null)
    }

    console.error('Normalizing', this.filename)
    childProcess.execFile('ffmpeg', ['-i', this.downloadedFile, '-filter:a', 'loudnorm', '-y', destFile], {}, (err) => {
      if (err) { console.error(err) }
      this.file = destFile
      this.normalizedFile = destFile

      callback()
    })
  }

  printResult (callback) {
    const data = {
      file: this.file,
      title: this.title
    }

    callback(null, data)
  }

  process (callback) {
    // this.useUrlAsFile(callback)

    async.waterfall(
      [
        done => this.generateFilename(done),
        done => this.renameExistingFiles(done),
        done => this.downloadFile(done),
        done => this.normalizeFile(done)
      ],
      callback
    )
  }
}
