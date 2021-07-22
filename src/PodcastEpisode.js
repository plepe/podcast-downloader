const fetch = require('node-fetch')
const async = require('async')
const fs = require('fs')
const child_process = require('child_process')

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

  useUrlAsFile (callback) {
    this.file = this.url
    callback()
  }

  generateFilename (callback) {
    this.filename = this.id + ' - ' + this.name + '.mp3'
    callback()
  }

  downloadFile (callback) {
    if (!this.filename) {
      console.error(this.id, 'no filename -> skip')
      return callback(null)
    }

    const destFile = 'orig/' + this.filename

    fs.stat(destFile,
     (err, data) => {
       if (!err) {
         console.error(this.id, this.filename, 'exists')
         this.file = destFile
         this.downloadFile = destFile
         return callback(null)
       }

       console.error(this.id, "Downloading", this.filename)

       fetch(this.url)
         .then(response => response.buffer(),
           err => {
             console.error('error downloading', this.filename)
           })
         .then(body => fs.writeFile(destFile, body,
           (err) => {
             if (err) { return callback(err) }

             this.file = destFile
             this.downloadFile = destFile
             callback(null)
           })
         )
      }
    )
  }

  normalizeFile (callback) {
    const destFile = 'data/' + this.filename

    async.parallel(
      {
        srcStat: done => fs.stat(this.downloadFile, (err, result) => {
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
          this.normalizedFile = destFile
          this.file = destFile
          return callback(null)
        }

        console.error("Normalizing", this.filename)
        child_process.execFile('ffmpeg', [ '-i', this.downloadFile, '-filter:a', 'loudnorm', '-y', destFile ], {}, (err) => {
          if (err) { console.error(err) }
          this.file = destFile
          this.normalizedFile = destFile

          callback()
        })
      }
    )
  }

  printResult (callback) {
    const data = {
      file: this.file,
      title: this.title
    }

    callback(null, data)
  }

  process (callback) {
    //this.useUrlAsFile(callback)

    async.waterfall(
      [
        done => this.generateFilename(done),
        done => this.downloadFile(done),
        done => this.normalizeFile(done)
      ],
      callback
    )
  }
}
