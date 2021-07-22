#!/usr/bin/env node

const Podcast = require('./src/Podcast')

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

const podcast = new Podcast(def, config)
podcast.process()
