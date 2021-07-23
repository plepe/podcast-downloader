#!/usr/bin/env node
const fs = require('fs')

const Podcast = require('./src/Podcast')

const config = {
  parallelTasks: 4
}

const profile = 'sternengeschichten'

fs.readFile(
  'profiles/' + profile + '.json',
  (err, result) => {
    if (err) {
      console.error(err.toString())
      process.exit(1)
    }

    const def = JSON.parse(result)

    const podcast = new Podcast(def, config)
    podcast.process()
  }
)
