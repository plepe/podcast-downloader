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

parser.add_argument('--url', {
  help: 'URL to download podcast episode list from (e.g. the RSS feed URL). Can be defined from the profile.',
  default: null
})

parser.add_argument('--id', {
  help: 'ID of the podcast - will be used to create a directory with that name.',
  default: null
})

parser.add_argument('--normalize', {
  help: 'Shall the audio files be normalized. Default: false, but can be overwritten by the selected profile.',
  choices: ['true', 'false']
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

    if (args.url) {
      def.url = args.url
    }

    if (args.id) {
      def.id = args.id
    }

    if (args.normalize) {
      def.normalize = args.normalize == 'true'
    }

    const podcast = new Podcast(def, config)
    podcast.process()
  }
)
