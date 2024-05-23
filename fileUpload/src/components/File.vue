<template>
    <div>
        <input type="file" @change="handleFileChange" />
        <el-button @click="handleUpload">上传文件</el-button>
        <h1>{{ fakeUploadPercentage }}</h1>
        <el-progress :percentage="fakeUploadPercentage"></el-progress>
        <el-button @click="cancelRequest"> 暂停上传</el-button>
        <el-button @click="handleResume">继续上传</el-button>
    </div>
</template>
<script setup>
import { reactive, computed, ref, watch } from "vue";
import axios from "axios";
import { CancelToken } from "axios";

/**
 * 定义切片上传状态
 * code = 1   成功上传
 * code = 0   未上传
 * code = 2   
 */

//  重试次数
const MAX_TRY_TIMES = 3

// 切片大小
const SIZE = 1 * 1024 * 1024;
//
let data = ref([]);
const container = reactive({
    file: null,
});
const requestList = ref([]);





// 上传文件监听
const handleFileChange = (e) => {
    const [file] = e.target.files;

const reader = new FileReader();
reader.readAsArrayBuffer(file);
reader.onload = function() {
  const binaryData = reader.result;
  // do something with the binary data


  console.log(binaryData)
}


    console.log(file,'获取到的file')
    if (!file) return;
    console.log(file,'file')
    container.file = file;
};

// 进度条
const fakeUploadPercentage = ref(0);
const hashPercentage = ref(0);

// 封装请求函数
const request = async ({
    url,
    method = "post",
    data,
    headers = {},
    RequestList,
    onProgress = (e) => e,
}) => {
    return new Promise((resolve, reject) => {
        const source = CancelToken.source();
        const config = {
            url: url,
            method: method,
            data: data,
            headers: headers,
            onUploadProgress: onProgress,
            cancelToken: source.token,
        };
        requestList?.value?.push(source);
        axios(config)
            .then((res) => {
                resolve({ data: res.data });
            })
            .catch((err) => {
                if (axios.isCancel(err)) {
                    console.log("请求取消", err.message);
                } else {
                    reject(err);
                }
            });
    });
};

// 取消请求
const cancelRequest = () => {
    console.log(requestList.value,'执行暂停')
    requestList.value.forEach((source) => source.cancel("请求被主动取消"));
    // 清空请求列表
    // 终止hash计算
    // 清空请求列表
    requestList.value = [];
    // 清空已上传列表
    // data.value = [];
    if (container.worker) {
        container.worker.terminate(); // 终止hash进程
    }
    console.log("已经暂停上传");
};

// 实现 promise retry
Promise.retry = (fn, options = {}) => {
    const {max = 3, delay = 0} = options
    let curMax = max

    return new Promise(async(resolve, reject) => {
        while(curMax--){
            try {
                const res = await fn()
                resolve(res)
                break
            } catch (error) {
                if(!curMax) reject(error)
            }
        }
    })

}

// 生成文件切片
const createFileChunk = (file, size = SIZE) => {
    console.log(file,'上传的文件')
    const fileChunkList = [];
    let current = 0;
    console.log(file);
    while (current < file.size) {
        fileChunkList.push({ file: file.slice(current, current + size) });

        current += size;
    }
    return fileChunkList;
};

const createProgressHandler = (item) => {
    return (e) => {
        item.percentage = parseInt(String((e.loaded / e.total) * 100));
    };
};

// 验证文件
const verifyUpload = async (filename, fileHash) => {
    try {
        const { data } = await request({
            url: "http://localhost:3000/verify",
            headers: {
                "content-type": "application/json",
            },
            data: {
                filename,
                fileHash,
            },
        });
        return data;

    } catch (error) {
        console.log("文件验证失败,", error);
    }
};

// 上传切片
const uploadChunks = async (uploadedList = []) => {
    const RequestList = data.value
        .filter(({ hash }) => !uploadedList.includes(hash))
        .map(({ chunk, hash, index }) => {
            if (!chunk) {
                return;
            }
            const formData = new FormData();
            console.log(chunk,chunk)
            formData.append("chunk", chunk);
            formData.append("hash", hash);
            formData.append("filename", container.file.name);
            // console.log(formData)
            return { formData, index };
        })
        .map(async ({ formData, index }) => {
                await Promise.retry(async () => {
                try {
                    console.log(formData)
                    await request({
                        url: "http://localhost:3000/upload",
                        data: formData,
                        onProgress: createProgressHandler(data.value[index]),
                        requestList: requestList.value,
                    });
                } catch (error) {
                    console.log('上传失败',error)
                    // 触发重试
                    throw error
                }

            },{max: MAX_TRY_TIMES, delay: 0})
        });
    await Promise.all(RequestList);
    if (data.value.every(({ percentage }) => percentage === 100)) {
        await mergeRequest();
    }
};

// 处理上传
const handleUpload = async () => {
    try {
        if (!container.file) return;
        const fileChunkList = createFileChunk(container.file);
        // console.log(fileChunkList);

        // container.hash = await calculateHash(fileChunkList);
    

        const { shouldUpload, uploadedList } = await verifyUpload(
            container.file.name,
            container.hash
        );

        if (!shouldUpload) {
            console.log("秒传，已上传");
            return;
        }

        data.value = fileChunkList.map(({ file }, index) => ({
            chunk: file,
            fileHash: container.hash,
            index,
            hash: container.file.name + "-" + index,
            percentage: 0,
        }));

        await uploadChunks(uploadedList);
        fakeUploadPercentage.value = uploadPercentage.value;
    } catch (error) {
        console.log(error);
    }
};

// 合并切片
const mergeRequest = async () => {
    await request({
        url: "http://localhost:3000/merge",
        headers: {
            "content-type": "application/json",
        },
        data: JSON.stringify({
            size: SIZE,
            filename: container.file.name,
            fileHash: container.hash,
        }),
    });
};

// 计算进度条
const uploadPercentage = computed(() => {
    const loaded = data.value
        .map((item) => item.chunk?.size * item?.percentage)
        .reduce((acc, cur) => acc + cur, 0);

    return parseInt((loaded / container.file?.size).toFixed(2));
});

// 计算哈希
const calculateHash = (fileChunkList) => {
    return new Promise((resolve) => {
        // 添加worker属性
        container.worker = new Worker("../../public/hash.js");
        // container.worker = new Worker('./pubilc/hash.js')
        container.worker.postMessage({ fileChunkList });
        container.worker.onmessage = (e) => {
            const { percentage, hash } = e.data;
            hashPercentage.value = percentage;
            if (hash) resolve(hash);
        };
    });
};

// 继续上传
const handleResume = async () => {
    const { uploadedList } = await verifyUpload(
        container.file.name,
        container.hash
    );
    await uploadChunks(uploadedList.map((item) => item.hash));
};

// 监听上传进度变化，并更新虚假的上传进度
watch(uploadPercentage, (val) => {
    fakeUploadPercentage.value = val;
});
</script>
<style></style>
