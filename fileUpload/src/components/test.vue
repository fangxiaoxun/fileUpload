<template>
    <div>{{ name }}</div>
    <button class="btn" @click="fn">这里是按钮</button>
</template>
<script setup>
    import { ref } from 'vue';
    const obj = ref({
        name:'fxx',
        age:1
    })
    const {name, age} = obj.value

    const fn = ()=> {
        obj.value.name = '9999999999'
        console.log(name)
        console.log(obj.value.name)
    }
    
</script>