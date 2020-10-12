/*
    Author: KotRik (vk.com/kotrik) 
*/
const WebSocket = require('ws');
const axios = require("axios");
const urlapi = require('url');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { document } = (new JSDOM(`<html></html>`)).window;

module.exports = class PixelBot {
    constructor (wsslink, store) {
        this.wsslink = wsslink;
        this.MAX_WIDTH = 1590
        this.MAX_HEIGHT = 400
        this.MAX_COLOR_ID = 25
        this.MIN_COLOR_ID = 0

        this.SIZE = this.MAX_WIDTH * this.MAX_HEIGHT
        this.SEND_PIXEL = 0

        this.ws = null;
        this.wsloaded = false;
        this.busy = false;

        this.isStartedWork = false;
        this.rCode = null;

        this.load(store).catch((e) => {
            console.log(e)
        })
    }

    async load (store) {
        this.startWork(store)
    }

    // async resolveCode(store) {
    //     try {
    //         let url = urlapi.parse(this.wsslink);
    //         let result = await axios.get("https://pixel2019.vkforms.ru/api/start", {
    //             'headers': {
    //                 'X-vk-sign': url.search
    //             }
    //         })

    //         let code = result.data.response.code;
    //         code = eval(store.replaceAll(code, "window.", ""))
    //         this.wsslink = this.wsslink.replace(/&c=.*/g, `&c=${code}`)
    //         console.log(`Код решён: ${code}`)
    //     } catch (e) {
    //         console.log(e)
    //         console.log("Произошла ошибка при решении кода")
    //     }
    // }

    async initWs (store) {
        //await this.resolveCode(store);
        this.ws = new WebSocket(this.wsslink, null, { headers: { 
            'Host': 'pixel-dev.w84.vkforms.ru',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.228',
            'Origin': 'https://prod-app7148888-0980885d2a54.pages.vk-apps.com',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }});

        this.ws.on('open', async () => {
            console.log("connected to websocket")
        })

        this.ws.on('message', async (event) => {
            while (this.busy) {
                await this.sleep(500)
            }
            
            try {
                this.busy = true;

                if ("string" === typeof event) {
                    //Json
                    if (event === "ping") {
                        this.ws.send("pong");
                    }
                    // try {
                    //     let a = JSON.parse(event)
                    //     // if (a['v']) {
                    //     //     // ТО что нужно!
                    //     //     // Так и предупреждение для копирастов, если вы копируйте мой скрипт на гитхаб
                    //     //     // Ну уважьте разраба поставьте копирайт @KotRikD
                    //     //     // Человеку тоже важен респект(
                    //     //     let codeRaw = a['v']['code']
                            
                    //     //     let code = codeRaw
                    //     //     let funnyReplacesHs = {
                    //     //         'window.': '',
                    //     //         'global': 'undefined',
                    //     //         "=== 'object'": "!== 'object'"
                    //     //     }
                    //     //     for (let replace of Object.keys(funnyReplacesHs)) {
                    //     //         // HS знаю что вы это видите, харе нам жизнь усложнять
                    //     //         // @in <3 @girl <3 @hs <3 from coin games
                    //     //         // разбаньте Вову(vk.com/m_vts)(
                    //     //         code = store.replaceAll(code, replace, funnyReplacesHs[replace])
                    //     //     }

                    //     //     this.rCode = eval(code);
                    //     //     this.ws.send("R"+this.rCode)
                    //     //     this.wsloaded = true;
                    //     //     console.log(`Код-R решён: R${this.rCode}`)
                    //     // }
                    // } catch (e) {
                        
                    // }
                    this.wsloaded = true;
                } else {
                    let c = this.toArrayBuffer(event)

                    for (var d = c.byteLength / 4, e = new Int32Array(c, 0, d), f = Math.floor(d / 3), g = 0; g < f; g++) {
                        var h = e[3 * g], i = e[1 + 3 * g], j = e[2 + 3 * g], k = this.unpack(h), l = k.x, m = k.y, n = k.color, o = k.flag;
                        // 1 - x
                        // 2 - y
                        // 3 - color
                        // 4 - uid
                        // 5 - gid
                        // 6 - flag
                        store.data[[l, m]] = n
                    }
                }

                if (!this.isStartedWork) {
                    this.startWork()
                }
                this.busy = false;
            } catch (e) {
                this.busy = false;
                console.log("idk of this type (ignore this)")
                console.log(e)
            }
        });

        this.ws.on('close', () => {
            this.ws = null;
            this.wsloaded = false;
        })
    }

    async startWork (store) {
        console.log("Запуск")
        this.isStartedWork = true;
        await store.load();

        while (true) {
            const keys = Object.keys(store.pixelDataToDraw);
            const ind = keys[Math.floor(Math.random() * keys.length)] // Рандомный элемент
            
            let color = store.pixelDataToDraw[ind]
            let coords = ind.split(",")
            if (store.data !== null && color === store.data[ind]) {
                continue
            }

            await this.send(color, this.SEND_PIXEL, coords[0], coords[1], store)
            if (store.data) {
                store.data[ind] = color
            }

            if (keys.length < 1) {
                break
            } 

            await this.sleep(60000) // 60 sec
        }
        this.isStartedWork = false;
    }

    async send (colorId, flag, x, y, store) {
        let c = new ArrayBuffer(4);
        new Int32Array(c, 0, 1)[0] = this.pack(colorId, flag, x, y)
        if (!this.ws) {
            await this.initWs(store);
        }
        while (!this.wsloaded) {
            await this.sleep(500)
        }
        this.ws.send(c)
        console.log(`Поставил пиксель: x${x} y${y} cid${colorId}`)
    }

    pack (colorId, flag, x, y) {
        let b = parseInt(colorId, 10) + parseInt(flag, 10) * this.MAX_COLOR_ID;
        return parseInt(x, 10) + parseInt(y, 10) * this.MAX_WIDTH + this.SIZE * b;
    }

    unpack (b) {
        let c = Math.floor(b / this.SIZE)
        let d = (b -= c * this.SIZE) % this.MAX_WIDTH;
        return {
            x: d,
            y: (b - d) / this.MAX_WIDTH,
            color: c % this.MAX_COLOR_ID,
            flag: Math.floor(c / this.MAX_COLOR_ID)
        };
    }

    sleep (time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    toArrayBuffer (buf) {
        var ab = new ArrayBuffer(buf.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    chunkString (str, length) {
        return str.match(new RegExp('.{1,' + length + '}', 'g'));
    }

    shuffle (array) {
        let currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }

}
