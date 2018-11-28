let notifier = require('node-notifier');
let puppeteer = require('puppeteer');
let fs = require('fs');
let PNG = require('pngjs').PNG
let pixelmatch = require('pixelmatch');

let semaphore_taken = false;
let setup_done = false;
let original;
let timeout;

if(process.argv[2] === null || !( timeout = parseInt(process.argv[3]) )){
    console.error("Invalid argument, run as 'node index.js {url} {timeout}'")
}

//setup
(async () => {
    puppeteer.launch().then(async (browser) => {

        let page = await browser.newPage();

        await page.goto(process.argv[2]);
        await page.screenshot({path: 'init.png', fullPage: true});

        let originalData= fs.readFileSync('init.png');
        let original = PNG.sync.read(originalData);

        // set interval
        setInterval(async function () {
            if (setup_done && !semaphore_taken) {
                semaphore_taken = true;

                console.log('Taking screenshot');

                let page = await browser.newPage();
                await page.goto(process.argv[2]);
                await page.screenshot({path: 'screenshot.png', fullPage: true});
                await page.close();

                let screenshotData = fs.readFileSync('screenshot.png');
                let screenshot = PNG.sync.read(screenshotData);


                let msgtreshold = (original.width * original.height) * 0;
                let mismatch = pixelmatch(original.data, screenshot.data, null, original.width, original.height, {threshold: 0});

                console.log(mismatch);
                console.log(msgtreshold);
                if (mismatch > msgtreshold) {
                    original = screenshot; //rewrite the original, else the message will repeat every time
                    notifier.notify(
                        {
                            title: 'Website changed',
                            message: `A change was detected on ${process.argv[2]}`,
                            sound: true, // Only Notification Center or Windows Toasters
                        },
                        function (err, response) {
                            // Response is response from notification
                            console.log('notification sent')
                        }
                    );
                }
                semaphore_taken = false;
            }
        }, timeout * 1000);
        console.log('Interval set');

        setup_done = true;
        notifier.notify(
            {
                title: 'Setup done',
                message: `You'll get a notification when the website changes`,
                sound: true, // Only Notification Center or Windows Toasters
            },
            function (err, response) {
                // Response is response from notification
                console.log('setup notification sent')
            }
        );
    }).catch(err => {
        console.error(err);
        process.exit(0);
    });

// graceful shutdown
    if (process.platform === "win32") {
        var rl = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on("SIGINT", function () {
            process.emit("SIGINT");
        });
    }

    process.on("SIGINT", async function () {
        console.log("Caught interrupt, shutting down");
        await browser.close();
        process.exit();
    });

})();
