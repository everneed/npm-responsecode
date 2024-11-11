const fs = require("fs")
const moment = require("moment")
const { nullCleanser, notNull } = require("@everneed/helper")

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
        // mix(<ResponseCode.result object :Object>)

        if(object.status) this.pushCode(...object.status)
        this.timestamp = moment().utc().format()
        if(object.data) this.pushData(object.data)
        if(object.trace) this.trace = {...this.trace, ...object.trace}

        this.#update()
    }
    createNew(object){
        /* Usage */
        // mix(<ResponseCode.result object :Object>)
        
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
        codes.forEach(code => this.status.add(code))

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
        if(typeof this.trace == "undefined") this.trace = {[code]: trace}
        else this.trace = {...this.trace, ...{[code]: trace}}

        this.#update()
    }
    deleteCode(...codes){
        codes.forEach(code=>{
            this.status.delete(code)
            console.log(code)
            if(this.trace?.[code]) delete this.trace[code]
        })

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
        codes.forEach(code=>{
            if(this.status.has(code)) return true
        })
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
    dictionary

    init(){
        this.dictionary = JSON.parse(fs.readFileSync(__dirname + "/dictionary.json"))
    }
    inject(json){
        /* Usage */
        // inject({
        //     issue: <moment().utc() format date :String>
        //     success:{
        //         <code :Number>:{
        //             title: <brief text>
        //             description: <explanation context>
        //         }
        //         ,...
        //     },
        //     error:{
        //         <code :Number>:{
        //             title: <brief text>
        //             description: <explanation context>
        //         }
        //         ,...
        //     }
        // })
    
        /* Define Head Variable */
        const dictionary = {
            input:{
                content: null,
                key: null,
                issue: null
            },
            current:{
                content: null,
                key: null,
                issue: null
            }
        }
    
        /* Injecting Head Variable */
        dictionary.current["content"] = JSON.parse(fs.readFileSync(__dirname + "/dictionary.json"))
        dictionary.input["content"] = nullCleanser(JSON.parse(json))
        dictionary.current["key"] = new Set(["issue", "success", "error"])
        dictionary.input["key"] = new Set(Object.keys(dictionary.input.content))
        dictionary.current["issue"] = Number(moment(dictionary.current.content.issue).format("x"))
        dictionary.input["issue"] = Number(moment(dictionary.input.content.issue).format("x"))
    
    
        /* Validation */
        if(!notNull(dictionary.input.content)) throw "injectDictionary() parameter received value of equal null"
        if(dictionary.current.key.intersection(dictionary.input.key).size < 3) throw "injectDictionary() wrong structure on json"
    
        /* Ingest Config File */
        // compare issue date
        if(dictionary.input.issue > dictionary.current.issue){
            // create dictionary file if
            // input date is higher
            fs.writeFileSync(__dirname + "/dictionary.json", JSON.stringify(dictionary.input.content))
            return this.dictionary = dictionary.input.content
        }
        else{
            return this.dictionary = dictionary.current.content
        }
    
    
    }
    title(code){
        let result
    
        switch(`${code}`[0]){
            case "2": result = this.dictionary.success[code] || null
            break;
            case "4": result =  this.dictionary.error[code] || null
            break;
            default: result = null
        }
    
        if(!result) throw new Error(`Invalid response code: ${code}`)
        return result.title
    }
    description(code){
        let result
    
        switch(`${code}`[0]){
            case "2": result = this.dictionary.success[code] || null
            break;
            case "4": result = this.dictionary.error[code] || null
            break;
            default: result = null
        }
    
        if(!result) throw new Error(`Invalid response code: ${code}`)
        return result.description
    }
}

const dictionary = new ResponseDictionary()
dictionary.init()

module.exports.dictionary = dictionary