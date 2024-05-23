const express = require("express");
const cors = require("cors");
const path = require("path");
const fse = require("fs-extra");
const multiparty = require("multiparty");
const { request } = require("http");

const app = express();
// 文件存储目录
const UPLOAD_DIR = path.resolve(__dirname, "..", "target");

// 获取文件类型后缀
const extractExt = filename => filename.slice(filename.lastIndexOf('.'), filename.length)

// 处理跨域
app.use(cors());

// 合并切片


const resolvePost = (req) =>
    new Promise((resolve) => {
        let chunk = "";
        req.on("data", (data) => {
            chunk += data;
        });
        req.on("end", () => {
            resolve(JSON.parse(chunk));
        });
    });

// 写入文件流
const pipeStream = (path, writeStream) =>
    new Promise((resolve) => {
        const readStream = fse.createReadStream(path);
        readStream.on("end", () => {
            fse.unlinkSync(path);
            resolve();
        });
        readStream.pipe(writeStream);
    });

// 合并切片
const mergeFileChunk = async (filePath, filename, size) => {
    const chunkDir = path.join(UPLOAD_DIR, 'chunkDir', filename)


    const chunksPath = await fse.readdir(chunkDir);

    // 根据下标进行排序
    chunksPath.sort((a, b) => a.split("-")[1] - b.split("-")[1]);

    // 并发写入文件
    await Promise.all(
        chunksPath.map(async (chunkPath, index) => {
            try {

                await pipeStream(
                    path.resolve(chunkDir, chunkPath),
                    fse.createWriteStream(filePath, {
                        start: index * size,
                    })
                );
            } catch (error) {
                console.error(error, 'tag')
            }
        })
    );
    // 删除切片保存目录
    fse.rmdirSync(chunkDir);
};

// 处理文件
app.post("/upload", (req, res) => {
    const multipart = new multiparty.Form();
    multipart.parse(req, async (err, fields, files) => {
        try {

            if (err) {
                console.log('文件上传错误', err)
                res.status(500).send('文件上传失败')
            } else {
                const [chunk] = files?.chunk;
                const [hash] = fields?.hash;
                const [filename] = fields?.filename;
    
                // 创建临时文件夹存储chunk
                const CHUNKDIR = path.join(UPLOAD_DIR, 'chunkDir', filename)
                try {
                    if (!fse.existsSync(CHUNKDIR)) {
                        await fse.mkdirs(CHUNKDIR);
                    }
                    if (fse.existsSync(`${CHUNKDIR}/${hash}`)) {
                        // 如果目标文件已经存在，可以选择删除或者重命名等操作

                        // await fse.remove(`${CHUNKDIR}/${hash}`);
                        console.log('文件已上传过')
                    }else{
                        await fse.move(chunk.path, `${CHUNKDIR}/${hash}`);

                    }
                    
                    // 清楚切片文件？
                    return res.send("received file chunk");
                } catch (error) {
                    console.error(error)
                    return res.status(500).send('文件上传失败')
                }

            }
        } catch (error) {
            console.error(error)
            res.status(500).send('文件处理失败')
        }


    });
});
// 合并文件切片
app.post("/merge", async (req, res) => {
    try {
        const data = await resolvePost(req);
        const { filename, size, fileHash } = data;
        const filePath = path.resolve(UPLOAD_DIR, `${fileHash}-${filename}`)
    
        await mergeFileChunk(filePath, filename, size);
        res.setHeader('Content-Type','application/json')
        return res.end(
            JSON.stringify({
                code: 0,
                msg: "file merged success",
            })
        );
        
    } catch (error) {
        console.log('切片合并失败',error)
        return res.status(500).send('合并文件切片失败')
    }
});


// 返回已上传的所有切片名
const createUploadedList = async (fileHash) => {
    return fse.existsSync(path.join(UPLOAD_DIR, 'chunkDir',fileHash)) ? await fse.readdir(path.join(UPLOAD_DIR,'chunkDir', fileHash)) : []
}






// 验证文件是否存在
app.post('/verify', async (req, res) => {
    const data = await resolvePost(req)

    const { filename, fileHash } = data
    const ext = extractExt(filename)
    // 这里路径可能会报错
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}-${filename}`)


    if (fse.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(
            JSON.stringify({
                shouldUpload: false
            })
        )
    } else {
        console.log(await createUploadedList(filename),'结果')
        return res.end(
            JSON.stringify({
                shouldUpload: true,
                uploadedList: await createUploadedList(filename)
            })
        )
    }
})





const PORT = 3000;
app.listen(PORT, () => {
    console.log("服务已启动，监听端口", PORT);
});
