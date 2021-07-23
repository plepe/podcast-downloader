const fs = require('fs')

module.exports = function listFiles (path, callback) {
  fs.readdir(path,
    (err, result) => {
      if (err) {
        return callback(err)
      }

      const list = {}
      result.forEach(file => {
        const m = file.match(/^([^-]+) - (.*)\.mp3$/i)

        if (m) {
          list[m[1]] = {
            id: m[1],
            name: m[2],
            filename: file
          }
        }
      })

      callback(null, list)
    }
  )
}
