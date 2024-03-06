const puppeteer = require("puppeteer")
const fetch = require("node-fetch")
const async = require("async")
const fs = require('node:fs').promises
const crypto = require("node:crypto")
const child_process = require("node:child_process")
const Buffer = require('node:buffer').Buffer
const node_url = require('node:url')

const OUT_DIRECTORY='/tmp/out'
fs.mkdir(OUT_DIRECTORY)

function h(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function fetchIt(url) {
    console.log("fetchIt", url)
    const response = await fetch(url)
    const blob = await response.blob()

    if (blob.size <= 0) {
        return
    }

    const arrayBuffer = await blob.arrayBuffer()

    const r = await fs.writeFile(`${OUT_DIRECTORY}/${h(url)}`, Buffer.from(arrayBuffer))
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

        const parsed = new node_url.URL(url)

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return
        }

        if (running.has(parsed.host + parsed.pathname)) {
            return
        }

        running.add(parsed.host + parsed.pathname)

        q.push(url)
    })

    console.log("page goto", url)
    try {

        await page.goto(url, {waitUntil: 'domcontentloaded'})

        await page.waitForFunction(() => {
            console.log(window.location.href)
            const locationCondition = window.location.href === url
            const readyStateCondition = window.document.readyState === 'interactive' || window.document.readyState === 'complete'
            return locationCondition && readyStateCondition
        })
    } catch (e) {
        console.error(e)
    } finally {
        q.push(url)
    }

    if (!q.idle()) {
        await q.drain()
    }
    
    await browser.close()

    console.log(q.idle())
    console.log("running.size", running.size)
    child_process.exec(`ls -l ${OUT_DIRECTORY}|wc -l`, (error, stdout, stderr) => {
        if (error) {
            console.error(error)
        }

        console.log(stdout)
    })
}

loadAndFetch(process.argv[2])
