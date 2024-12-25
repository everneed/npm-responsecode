const path = require("path")
const moment = require("moment")
const { nullCleanser, notNull, pipe } = require("@everneed/helper")

module.exports.ResponseCode = class ResponseCode{
    status;
    timestamp;
    data;
    trace;
    result;


    constructor(object = {}){
        this.status = new Set()

        if(object.status) this.pushCode(...object.status)
        this.timestamp = moment().utc().format()
        if(object.data) this.pushData(object.data)
        if(object.trace) this.trace = {...this.trace, ...object.trace}

        this.#update()
    }
    mix(object){
        /* Usage */
        // mix(<ResponseCode.result object|ResponseCode instance :Object>)

        if(object.status) this.pushCode(...object.status)
        this.timestamp = moment().utc().format()
        if(object.data) this.pushData(object.data)
        if(object.trace) this.trace = {...this.trace, ...object.trace}

        this.#update()
    }
    createNew(object){
        /* Usage */
        // createNew(<ResponseCode.result object|ResponseCode instance :Object>)
        
        this.reset()

        if(object.status) this.pushCode(...object.status)
        this.timestamp = moment().utc().format()
        if(object.data) this.pushData(object.data)
        if(object.trace) this.trace = {...this.trace, ...object.trace}

        this.#update()
    }
    reset(){
        /* Usage */
        // reset()

        this.status = new Set()
        this.timestamp = undefined
        this.data = undefined
        this.trace = undefined

        this.#update()
    }

    pushCode(...codes){
        // responsecode.pushCode(<code :Number>,...)

        /* convert ENUMs into NUMs */
        codes = codes.map(x=>{
            if(!Number(x)) return dictionary.code(x)
            return Number(x)
        })

        /* smart switch-side detection & templater */
        if(`${codes[0]}`[0] == 2){
            this.status.add(2000)
            for(const code of this.status){
                if(`${code}`[0] == 4) this.deleteCode(code)
            }
        }
        else if(`${codes[0]}`[0] == 4){
            this.status.add(4000)
            for(const code of this.status){
                if(`${code}`[0] == 2) this.deleteCode(code)
            }
        }

        /* actual process */
        for(const code of codes){
            this.status.add(code)
        }

        this.#update()
    }
    pushData(data){
        // responsecode.pushData(<data :Object|Array>)
        if(typeof this.data == "undefined") this.data = data
        else if(Array.isArray(this.data)) this.data = [...this.data, ...data]
        else if(Object.keys(this.data).length) this.data = {...this.data, ...data}
        else this.data = data

        this.#update()
    }
    pushTrace({code, trace}){
        // responsecode.pushTrace({code: <code :Number>, trace: <custom error handle in front :Any>})

        /* convert ENUMs into NUMs */
        if(!Number(code)) code = dictionary.code(code)

        if(typeof this.trace == "undefined") this.trace = {[code]: trace}
        else this.trace = {...this.trace, ...{[code]: trace}}

        this.#update()
    }
    deleteCode(...codes){

        /* convert ENUMs into NUMs */
        codes = codes.map(x=>{
            if(!Number(x)) return dictionary.code(x)
            return Number(x)
        })

        for(const code of codes){
            this.status.delete(code)
            if(this.trace?.[code]) delete this.trace[code]
        }

        this.#update()
    }
    deleteData(){
        this.data = undefined

        this.#update()
    }

    checkError(){
        if(this.status.has(4000)) return true
        return false
    }
    hasCode(...codes){
        // hasCode(<code :Number>,...)

        /* convert ENUMs into NUMs */
        codes = codes.map(x=>{
            if(!Number(x)) return dictionary.code(x)
            return Number(x)
        })
        
        for(const code of codes){
            if(this.status.has(code)) return true
        }
        return false
    }

    #update(){
        this.result = {
            status: [...this.status],
            data: typeof this.data != "undefined" ? this.data : undefined,
            trace: typeof this.trace != "undefined" ? this.trace : undefined,
            timestamp: moment().utc().format()
        }
    }
}

class ResponseDictionary{
    #numDictionary = {}
    #enumDictionary = {}
    #configPath = null

    constructor(){
        this.init()
        this.#generateReverse()
    }
    init(){
        let json
        if(!this.#configPath){
            try{
                json = require("../../../responsecode.json")
            }
            catch(err){
                json = {2000:{enum: "SUCCESS", title: "Success", description: "Success header"}}
            }
        }
        else{
            const fs = require("fs")
            json = pipe(this.#configPath)
            .then(relativePath=> path.resolve(__dirname, relativePath))
            .then(truePath=> fs.readFileSync(truePath))
            .then(json=> JSON.parse(json))
            .result
        }

        /* Validation */
        if(!notNull(json)) throw "injectDictionary() parameter received value of equal null"
        for(const code in json){
            if(!/^[2|4]{1}([0-9]){3}$/.test(code)) throw `injectDictionary() invalid code structure of ${code} on json`
            
            const key = new Set(Object.keys(json[code]))
            const must = new Set(["enum", "title", "description"])

            if(must.intersection(key).size < 3) throw `injectDictionary() invalid key structure of ${code} on json`
        }

        this.#numDictionary = json
        this.#generateReverse()
    }
    config(configPath){
        this.#configPath = path.join("../../..", configPath)

        /* Re-init */
        this.init()
    }
    #generateReverse(){
        for(const num in this.#numDictionary){
            this.#enumDictionary[this.#numDictionary[num].enum] = {
                num: num,
                title: this.#numDictionary[num].title,
                description: this.#numDictionary[num].description
            }
        }
    }
    code(enumCode){
        const result = Number(this.#enumDictionary[enumCode].num) || null
        if(!result) throw new Error(`Invalid response code: ${enumCode}`)
        return result
    }
    enum(numCode){
        const result = this.#numDictionary[numCode].enum || null
        if(!result) throw new Error(`Invalid response code: ${numCode}`)
        return result
    }
    title(code){
        let result

        if(Number(code)) result = this.#numDictionary[code].title
        else if(!Number(code)) result = this.#enumDictionary[code].title
        else result = null
    
        if(!result) throw new Error(`Invalid response code: ${code}`)
        return result
    }
    description(code){
        let result

        if(Number(code)) result = this.#numDictionary[code].description
        else if(!Number(code)) result = this.#enumDictionary[code].description
        else result = null
    
        if(!result) throw new Error(`Invalid response code: ${code}`)
        return result
    }
}

const dictionary = new ResponseDictionary()
dictionary.init()

module.exports.dictionary = dictionary