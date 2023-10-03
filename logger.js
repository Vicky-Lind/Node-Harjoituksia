const fs = require('fs')
// const timestamp = new Date()
// const isoTimestamp = timestamp.toISOString()
// let operation = 'Data fetch operation'
// let status = 'processed successfully'
// let entry = operation + ' ' + status + ' @ ' + isoTimestamp + '\n'

// console.log(entry)

// fs.appendFile('dataOperations.log', entry, (err) => {
//   if (err) {
//     console.log(err)
//   }
// })
const fileName = 'dataOperations.log'

const log = (entry) => {
    const isoTimestamp = new Date().toISOString()
    let logRow = entry + ' ' + fileName + ' @ ' + isoTimestamp + '\n'
    fs.appendFile(fileName , logRow, (err) => {
        if (err) {
        console.log(err)
        }
    })
    }


module.exports = {
    log
}