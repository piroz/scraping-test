const puppeteer = require("puppeteer")
const fetch = require("node-fetch")
const async = require("async")
const fs = require('node:fs').promises
const crypto = require("crypto")
const child_process = require("node:child_process")
const Buffer = require('node:buffer').Buffer

function h(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function fetchIt(url) {
    console.log(Date.now())
    const response = await fetch(url)
    const blob = await response.blob()

    if (blob.size <= 0) {
        return
    }

    const arrayBuffer = await blob.arrayBuffer()

    const r = await fs.writeFile(`/tmp/${h(url)}`, Buffer.from(arrayBuffer))
    console.log(r)
}

async function loadAndFetch(url) {

    const browser = await puppeteer.launch({
        args: [
            "--no-sandbox"
        ]
    })

    const page = await browser.newPage()

    const running = new Set()

    const q = async.queue((url, callback) => {
        fetchIt(url).then(() => {
            callback()
        }, err => {
            console.error(err)
            callback()
        })
    }, 1)

    q.error(err => console.error(err))

    page.on("response", res => {
        const url = res.url()

        if (running.has(url)) {
            return
        }

        running.add(url)

        q.push(url)
    })

    await page.goto(url, {waitUntil: 'networkidle2'})

    if (!q.idle()) {
        await q.drain()
    }
    
    await browser.close()

    console.log(running.size)
    console.log(q.idle())

    const command = child_process.spawn('du', ['-h', `/tmp`])

    command.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    })
    
    command.on('close', (code) => {
        console.log(`child process close all stdio with code ${code}`);
    })
    
    command.on('exit', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}

loadAndFetch(process.argv[2])
