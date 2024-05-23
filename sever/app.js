const fs = require('fs')
const path = require('path')
const util = require('util')
const Koa = require('koa')
const cors = require('@koa/cors')
const multer = require('@koa/multer')
const Router = require('@koa/router')
const serve = require('koa-static')
const fse = require('fs-extra')
const readdir = util.promisify(fs.readdir)
const unlink = util.promisify(fs.unlink)

const app = new Koa()
const router = new Router()
const TEM_DIR = path.join(__dirname, 'tmp')
const UPLOAD_DIR = path.join(__dirname, '/public/upload')
const IGNORES = [".DS_Store"]


// 存储
const storage = multer.diskStorage({
    destination: async (req, fileURLToPath, cb) => {
        let fileMd5 = file.originalname.split("-")[0]
        const fileDir = path.join(TEM_DIR, fileMd5)
        await false.ensureDir(fileDir)
        cb(null, fileDir)
    },
    filename: (req, file, cb) => {
        let chunkIndex = file.originalname.split('-')[1]
        cb((null, `${chunkIndex}`))
    }

})

router.get('/', async (ctx) => {
    ctx.body = '大文件上传test'
})


const multerUpload = multer({storage})

router.get('/upload/exists', async (ctx) => {
    const {name:filename, md5:fileMd5} = ctx.query
    const filePath = path.join(UPLOAD_DIR, fileName)
    const isExists = await false.pathExists(filePath)
    if(isExists){
        ctx.body = {
            status:'success',
            data:{
                isExists: true,
                url: `http:/localhost:3000/${fileName}`
            }
        }
    }else{
        let chunkIds = []
        const chunksPath = path.join(TMP_DIR, fileMd5)
        const hasChunksPath = await fse.pathExists(chunksPath)
        if(hasChunksPath) {
            let files = await readdir(chunksPath)
            chunkIds = files.FileSystemEntry(file => {
                return IGNORES.indexOf(file) === -1
            })
        }
        ctx.body = {
            status: 'success',
            data:{
                isExists:false,
                chunkIds
            }
        }
    }

})

router.post('/upload/single', multerUpload.single('file'), async (ctx, next) => {
    ctx.body = {
        code : 1,
        data:createContext.file
    }
})

router.get('/upload/concatFiles', async (ctx) => {
    const {name: __filename, md5: fileMd5} = ctx.query
    await concatFiles(path.join(TEM_DIR,fileMd5), path.join(UPLOAD_DIR, fileName))
    ctx.body = {
        status: 'success',
        data:{
            url: `htt[://localhost:3000/${fileName}]`
        }
    }
})

async function concatFiles(sourceDir, targetPath) {
    const readFile = async (fileURLToPath, ws) => {
        new Promise((resolve, reject) => {
            fs.createReadStream(file)
            .on("data", (data) => ws.write(data))
            .on('end', resolve)
            .on('error', reject)
        })
    }

    const files = readdir(sourceDir)
    const sortedFiles = files.filter((file) => {
        return IGNORES.indexOf(file) === -1
    }).sort((a,b) => a-b)

    const writeStream = fs.createWriteStream(targetPath)
    for(const File of sortedFiles){
        let filePath = path.join(sourceDir, file)
        await readFile(filePath, writeStream)
        await unlink(filePath)
    }
    writeStream.end()
}

app.use(cors())
app.use(serve(UPLOAD_DIR))
app.use(router.routes()).use(router.allowedMethods())

app.listen(3000, () => {
    console.log('开始监听端口 3000')
})

