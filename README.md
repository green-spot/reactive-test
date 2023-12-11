**個人的に実験で開発しているものです。プロダクション環境では使わないでください。**

## 特徴
- Pure JavaScript
- リアクティブライブラリ
- Svelte風文法
- **eval使用**

## 基本

JavaScript上で`env.x`の値を操作すると、HTML上の`{x}`がReactiveに更新されます。

```javascript
import {app, createEnv} from "./lib.js";

const env = createEnv({x: 0})
app("#app", env);
```

```html
<div id="app">
  <template>
    <p>{x}</p>
  </template>
</div>
```

### タイマーアプリ

```javascript
import {app, createEnv} from "./lib.js";

const env = createEnv({i: 0})
app("#app", env);

setInterval(() => env.i++, 1000);
document.querySelector("button").addEventListener("click", () => env.i = 0);
```

```html
<div id="app">
  <template>
    <p>{i}</p>
  </template>
</div>
<button type="button">Reset</button>
```


## Syntax

### if

```javascript
const env = createEnv({
  isDone: false
})
app("#app", env);

document.body.addEventListener("click", ({target}) => {
  if(target.className === "check") env.isDone = true;
});
```

```html
<div id="app">
  <template>
    <p>
      {#if isDone}
      Done
      {:else}
      <label><input type="checkbox" class="check"> Check</label>
      {/if}
    <p>
  </template>
</div>
```

### each

```javascript
const env = createEnv({
  fruits: ["Apple", "Lemon", "Orange"]
})
app("#app", env);
```

```html
<div id="app">
  <template>
    <ul>
      {#each fruits as fruit, i}
      <li>{i}: {fruit}</li>
      {/each}
    </ul>
  </template>
</div>
```

### template

```javascript
const env = createEnv({});
app("#app", env);
```

```html
<template id="my-template">
  <p>Hello World!</p>
</template>

<div id="app">
  <template>
    {#template my-template}
  </template>
</div>
```
