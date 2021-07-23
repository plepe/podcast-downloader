#!/usr/bin/env node
const fs = require('fs')
const ArgumentParser = require('argparse').ArgumentParser

const Podcast = require('./src/Podcast')

const config = {
  parallelTasks: 4
}

const parser = new ArgumentParser({
  add_help: true,
  description: 'Downloads all episodes of a podcast and optionally normalizes them. Also creates a JSON playlist.'
})

parser.add_argument('--profile', '-p', {
  help: 'Which profile to use (default: "default").',
  default: 'default'
})

const args = parser.parse_args()

fs.readFile(
  'profiles/' + args.profile + '.json',
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
