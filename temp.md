## Lesson 2｜清單與表格

### **把一堆資料整理起來**

假設今天我們想在網頁上列出等等要做的事情：

```text
預習 HTML
完成練習
上傳作業
```

如果只是一般文字，瀏覽器其實不知道這三行彼此之間有什麼關係。

我們當然也可以寫成：

```html
<p>預習 HTML</p>
<p>完成練習</p>
<p>上傳作業</p>
```

畫面上看起來沒什麼問題，但對 HTML 來說，它們就只是三段各自獨立的文字。

如果這三個項目其實是「同一份清單」，我們就可以使用 HTML 的**清單標籤**把它們整理起來。

### **沒有順序的清單 `<ul>`**

如果這些項目沒有特別的先後順序，就可以使用 `<ul>`，也就是 **Unordered List（無順序清單）**。

例如：

```html
<ul>
  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript</li>
</ul>
```

`<ul>` 可以想像成裝著整份清單的大房間，而每一個 `<li>`，也就是 **List Item（清單項目）**，則是放在裡面的一個個項目。

所以在這裡，`<ul>` 是 `<li>` 的父元素，而 `<li>` 是 `<ul>` 的子元素。

### **有順序的清單 `<ol>`**

但如果順序很重要，例如：

```text
1. 打開 VS Code
2. 建立 HTML
3. 使用瀏覽器開啟
```

這時候就可以使用 `<ol>`，也就是 **Ordered List（有順序清單）**。

```html
<ol>
  <li>打開 VS Code</li>
  <li>建立 HTML</li>
  <li>使用瀏覽器開啟</li>
</ol>
```

可以先簡單記成：

* `<ul>`：順序不重要
* `<ol>`：順序很重要
* `<li>`：清單裡面的每一個項目

### **有列、有欄的資料就交給表格**

假如今天我們想整理飲料店的菜單：

```text
紅茶　中杯　30元
奶茶　大杯　55元
綠茶　中杯　35元
```

這些資料其實都可以再分成：

**飲品名稱、尺寸、價格**

像這種具有明確**列與欄關係**的資料，就很適合使用 `<table>` 表格來整理。

例如：

```html
<table>
  <caption>飲料價目表</caption>

  <tr>
    <th>飲品</th>
    <th>尺寸</th>
    <th>價格</th>
  </tr>

  <tr>
    <td>紅茶</td>
    <td>中杯</td>
    <td>30 元</td>
  </tr>

  <tr>
    <td>奶茶</td>
    <td>大杯</td>
    <td>55 元</td>
  </tr>

  <tr>
    <td>綠茶</td>
    <td>中杯</td>
    <td>35 元</td>
  </tr>
</table>
```

可以把 `<table>` 想成整張 Excel 表格。

而表格裡又會包含不同的元素：

* `<caption>`：這張表格的標題
* `<tr>`：表格中的一整列
* `<th>`：欄位的標題
* `<td>`：真正放資料的格子

所以它們之間一樣會形成父元素與子元素的關係。

### **`<caption>`：幫表格取一個名字**

`<caption>` 可以想像成**這張表格自己的標題**。

例如：

```html
<table>
  <caption>飲料價目表</caption>
  ...
</table>
```

它是在告訴瀏覽器：

**「下面這整張表格是在介紹飲料的價格。」**

而且 `<caption>` 會直接放在 `<table>` 裡面，所以它本身就是這張表格結構的一部分。

### **那 `<caption>` 和 `<h2>` 有什麼不同？**

我們其實也可以在表格上方寫：

```html
<h2>今日推薦飲品</h2>

<table>
  ...
</table>
```

畫面上看起來可能和 `<caption>` 有一點像，但它們代表的意思不太一樣。

`<h2>` 是網頁裡的一個**標題元素**，可以拿來替整個區塊下標題。

而 `<caption>` 則是**專門屬於 `<table>` 的表格標題**。

可以先簡單理解成：

```text
<h2>      → 這一個區塊在講什麼？
<caption> → 這一張表格在講什麼？
```

例如：

```html
<h2>今日推薦飲品</h2>

<p>今天有幾款人氣飲料可以選擇。</p>

<table>
  <caption>飲料價目表</caption>
  ...
</table>
```

這裡 `<h2>` 負責告訴我們整個區塊是在介紹「今日推薦飲品」。

而 `<caption>` 則更精確地告訴我們：**這張表格是「飲料價目表」**。

現階段不用把兩個想得太複雜，只要記得：**如果是替一張 `<table>` 加上專屬標題，就可以使用 `<caption>`。**


## Lesson 3｜表單與輸入元素

### **網站不只是把資料顯示給你看**

前面學到的 HTML，大部分都是把內容放到網頁上給使用者看。

例如：

```html
<h1>登入會員</h1>
<p>請輸入帳號與密碼</p>
```

但真正的網站通常不會只有「網站給你看東西」，有時候也需要反過來讓**使用者把資料交給網站**。

像是：

```text
帳號：____________
密碼：____________

      登入
```

這時候就會使用到 HTML 的**表單（Form）**。

### **`<form>` 就像是一張表單**

我們平常填寫報名表時，會有姓名、Email、電話等等不同欄位。

HTML 的 `<form>` 也可以想像成一張表單的大範圍，裡面可以放入不同的輸入元素。

```html
<form>
  <input>
  <button>送出</button>
</form>
```

`<form>` 就像一個大房間，而 `<input>`、`<button>` 等表單元素則被放在這個房間裡面。

### **`<label>` 告訴你這格要填什麼**

如果我們只有：

```html
<input>
<input>
```

使用者根本不知道第一格和第二格到底要輸入什麼。

所以通常會搭配 `<label>`：

```html
<label for="account">帳號</label>
<input id="account">

<label for="password">密碼</label>
<input id="password" type="password">
```

`<label>` 可以想像成貼在輸入框旁邊的標籤，告訴使用者「這一格是做什麼的」。

其中 `for="account"` 和 `id="account"` 使用相同的名稱，就可以把這個標籤和對應的輸入框連在一起。

### **不同的 `type` 代表不同用途**

輸入框也不一定只能輸入一般文字。

例如：

```html
<input type="text">
<input type="email">
<input type="password">
```

我們可以透過 `type` 告訴瀏覽器：

「這一格要輸入一般文字。」

「這一格應該是 Email。」

「這一格是密碼。」

如果某個欄位一定要填，也可以加入：

```html
<input type="email" required>
```

`required` 就是在告訴瀏覽器：「這一格不能空著。」

## Lesson 4｜選擇器與特異度

### **CSS 要先知道「你想改誰」**

HTML 把房子的結構蓋好之後，接下來 CSS 就像開始進行裝潢。

假設網頁裡有：

```html
<h1>我的網站</h1>
<p>歡迎來到我的網站</p>
<button>開始</button>
```

今天我們想把按鈕改成藍色，總不能只跟 CSS 說：

```text
幫我把它改成藍色
```

CSS 必須先知道：

**「你到底要修改哪一個元素？」**

這就是**選擇器（Selector）**的用途。

### **使用不同的方法找到元素**

最直接的方式，就是直接使用 HTML 標籤名稱：

```css
button {
  background: blue;
}
```

代表：

「找到所有 `<button>`。」

如果只想找到某一群元素，可以使用 `class`：

```html
<button class="primary">送出</button>
```

```css
.primary {
  background: blue;
}
```

如果是一個具有特定 `id` 的元素，也可以使用：

```css
#save {
  background: blue;
}
```

可以把選擇器想像成 CSS 用來「點名」HTML 元素的方法。

### **如果很多規則同時選到它呢？**

假設：

```css
button {
  background: orange;
}

.primary {
  background: blue;
}

#save {
  background: pink;
}
```

同一個元素可能同時符合很多條 CSS 規則。

這時候 CSS 就需要判斷：

**「到底哪一條規則比較明確？」**

這個判斷方式就和**特異度（Specificity）**有關。

現階段可以先理解成：不同的選擇方式會有不同的優先程度，之後當樣式「明明有寫卻沒有生效」時，特異度就是很重要的除錯方向。

## Lesson 5｜偽類與偽元素

### **元素也會有不同的「狀態」**

假設我們有一個按鈕：

```html
<button>開始學習</button>
```

平常它可能長這樣：

```css
button {
  background: white;
}
```

但我們可能希望滑鼠移到它上面的時候，按鈕才變成藍色。

也就是：

```text
平常 → 白色
滑鼠移上去 → 藍色
```

這代表我們不是單純修改「按鈕」，而是要修改**按鈕在某個狀態下的樣子**。

### **偽類：指定元素的狀態**

CSS 可以透過**偽類（Pseudo-class）**選擇元素的某個狀態。

例如：

```css
button:hover {
  background: blue;
  color: white;
}
```

`:hover` 就代表：

「滑鼠目前移到這個元素上。」

另外像：

```css
input:focus {
  border-color: blue;
}
```

`:focus` 則可以用來處理輸入框被點擊、正在輸入時的狀態。

可以把偽類想像成：

**「元素現在正在做什麼？」**

### **偽元素：在元素前後多加一些裝飾**

另外還有一個名字很像的東西叫做**偽元素（Pseudo-element）**。

例如我們原本只有：

```html
<h2 class="title">必填欄位</h2>
```

但想在前面多加一個裝飾：

```css
.title::before {
  content: "★";
}
```

畫面就可以變成：

```text
★ 必填欄位
```

這個 `★` 並沒有真的寫在原本的 HTML 裡，而是由 CSS 額外產生。

所以可以先這樣區分：

* **偽類**：處理元素的狀態
* **偽元素**：替元素產生額外的部分或裝飾

## Lesson 6｜盒模型與 box-sizing

### **在 CSS 裡，每個元素都可以看成一個盒子**

前面學 HTML 時，我們把網站想像成一棟房子，再透過不同的標籤劃分出各種房間。

到了 CSS，我們要換一個角度來看這些元素：

**在 CSS 裡，每一個 HTML 元素都可以想像成一個盒子。**

例如：

```html
<div class="card">
  我的卡片
</div>
```

這張卡片其實不只有文字本身，它周圍還可能有一層一層不同的空間。

### **一個盒子從裡到外有四層**

可以先想像成：

```text
margin

  border

    padding

      content
```

最裡面的 `content` 是真正放文字或內容的地方。

`padding` 是內容和邊框之間的空間。

`border` 是元素的邊框。

最外面的 `margin` 則是這個元素和其他元素之間的距離。

所以當你寫：

```css
.card {
  width: 200px;
  padding: 20px;
  border: 5px solid blue;
}
```

元素最後佔用的空間，不一定就真的只有 `200px`。

### **`box-sizing` 幫我們控制尺寸怎麼計算**

如果我們希望：

```css
width: 200px;
```

代表這個元素包含 padding 和 border 之後，整體還是維持在 200px，可以使用：

```css
.card {
  box-sizing: border-box;
  width: 200px;
}
```

所以之後遇到：

「我明明設定 200px，為什麼它還是超出去？」

很多時候就可以回來檢查一下**盒模型**。

## Lesson 7｜文字排版

### **文字能看，不代表好看也好讀**

假設我們有一篇文章：

```text
學習程式設計需要不斷練習，也需要閱讀與整理筆記。
```

就算內容完全一樣，如果文字很小、每一行又全部擠在一起，閱讀起來還是會非常痛苦。

所以文字排版不只是：

**「把字變大或變小。」**

還需要考慮字和字之間、行和行之間的空間，以及文字本身的粗細、位置與裝飾。

### **調整文字的大小與粗細**

最基本的就是：

```css
p {
  font-size: 16px;
}
```

`font-size` 可以控制文字大小。

如果是標題，我們還可能使用：

```css
h1 {
  font-weight: 700;
}
```

`font-weight` 可以控制文字的粗細。

就像書本裡的標題通常比較大、比較粗，內文則比較小，透過不同層級讓讀者快速知道哪裡是重點。

### **行距和字距也會影響閱讀**

例如：

```css
p {
  line-height: 1.8;
  letter-spacing: 0.5px;
}
```

`line-height` 可以調整每一行文字之間的距離。

`letter-spacing` 則可以調整每個字元之間的距離。

你可以把文字排版想像成排隊：

人全部擠在一起會很難看清楚，但距離拉得太遠又會顯得很鬆散。

我們要做的，就是找到一個看起來舒服、又容易閱讀的距離。

### **`text-align`：控制文字要靠哪一邊**

除了文字本身的大小之外，我們也可以調整文字在元素裡的位置。

例如：

```css
h1 {
  text-align: center;
}
```

`text-align` 可以控制文字在元素內要靠左、置中還是靠右。

常見的有：

```css
text-align: left;
text-align: center;
text-align: right;
```

要注意的是，`text-align` 是在控制：

**「文字在這個元素擁有的空間裡，要放在哪個位置。」**

例如 `<h1>`、`<p>` 這類元素預設通常會佔滿父元素可以使用的寬度，所以：

```css
h1 {
  text-align: center;
}
```

看起來就會像把標題移到了畫面的中間。

可以想像成：

```text
|              這是一段標題              |
|<----------- 元素的寬度 ------------->|
```

文字並不是自己跑到網頁正中央，而是在它原本佔有的這整塊空間裡被置中。

### **`text-decoration`：幫文字加上裝飾線**

我們也可以使用 `text-decoration` 替文字加入一些簡單的裝飾。

例如：

```css
a {
  text-decoration: underline;
}
```

會替文字加上底線。

也可以使用：

```css
text-decoration: line-through;
```

做出刪除線效果。

例如原本：

```text
原價 100 元
```

加入刪除線後，就可以做成類似：

```text
原價 100 元
```

常見的值可以先認識：

```css
text-decoration: underline;
text-decoration: line-through;
text-decoration: none;
```

其中 `none` 很常被拿來移除超連結 `<a>` 預設的底線：

```css
a {
  text-decoration: none;
}
```

### **簡單整理**

文字排版常見的 CSS 可以先記成：

```text
font-size
→ 文字有多大

font-weight
→ 文字有多粗

line-height
→ 每一行之間的距離

letter-spacing
→ 字與字之間的距離

text-align
→ 文字在元素裡靠左、置中或靠右

text-decoration
→ 底線、刪除線等文字裝飾
```

這些屬性單獨看都很簡單，但搭配起來，就可以讓原本普通的一段文字變得更有層次、也更容易閱讀。

## Lesson 8｜色彩與背景

### **開始幫房子上色**

前面我們已經把 HTML 的房子蓋起來，也開始用 CSS 調整元素的大小與文字。

接下來就可以開始替房子：

**油漆、貼壁紙、換不同的背景。**

假設原本有：

```html
<section>
  <h2>今天的風景</h2>
</section>
```

沒有 CSS 時，它就只是很單純的一個區塊。

### **文字顏色與背景顏色**

我們可以使用：

```css
section {
  background-color: blue;
  color: white;
}
```

`color` 負責的是**文字顏色**。

`background-color` 則負責**元素的背景顏色**。

所以不要看到 `color` 就以為是在控制所有顏色，它主要是控制文字。

### **背景也不一定只能有一種顏色**

除了純色之外，CSS 還可以建立漸層：

```css
section {
  background: linear-gradient(blue, pink);
}
```

`linear-gradient()` 可以讓背景從一種顏色慢慢變成另一種顏色。

例如：

```text
藍色
 ↓
紫色
 ↓
粉色
```

就很像天空從白天慢慢變成夕陽。

背景也可以使用圖片，所以之後我們可以依照不同需求，選擇純色、圖片或漸層來建立整個網頁的氣氛。

## Lesson 9｜圓角 border-radius

### **HTML 元素原本大多是方方正正的**

假設我們有一個按鈕：

```html
<button>開始學習</button>
```

如果只設定背景：

```css
button {
  background: blue;
}
```

它看起來通常就是一個比較方正的矩形。

但現在很多網站的按鈕、卡片或輸入框，都不會使用非常生硬的直角。

### **把四個角「磨圓」**

這時候就可以使用：

```css
button {
  border-radius: 10px;
}
```

`border-radius` 可以想像成拿工具把盒子的四個尖角慢慢磨圓。

數值比較小：

```css
border-radius: 4px;
```

就只是稍微圓一點。

數值越大，整體就會越圓。

### **圓角不只是圓角**

如果一個元素本身的寬和高相同：

```css
.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
```

就可以把原本的正方形變成一個圓形。

另外像按鈕：

```css
button {
  border-radius: 999px;
}
```

也很常拿來製作現在網站裡常見的**膠囊形按鈕**。

所以 `border-radius` 不只是把角弄圓，也可以拿來建立不同的介面造型。

## Lesson 10｜陰影 box-shadow / text-shadow

### **為什麼加上陰影之後會感覺「浮起來」？**

現實世界裡，只要有光線，物體通常就會留下陰影。

我們也會透過陰影判斷：

「這個東西是不是離桌面有一點距離？」

網頁介面也是一樣。

假設原本只有：

```css
.card {
  background: white;
}
```

它可能會感覺直接黏在背景上。

### **使用 `box-shadow` 加上空間感**

加入：

```css
.card {
  box-shadow: 0 8px 20px #00000022;
}
```

就可以替整個元素加入陰影。

`box-shadow` 可以控制陰影：

* 往哪個方向偏移
* 模糊多少
* 擴張多少
* 使用什麼顏色

所以透過不同的數值，我們可以讓卡片感覺浮起來，也可以做出按鈕被壓下去的效果。

### **文字也可以有自己的陰影**

如果今天不是要替盒子加陰影，而是文字：

```css
h1 {
  text-shadow: 2px 2px 4px #00000055;
}
```

就可以使用 `text-shadow`。

可以先簡單記成：

* `box-shadow`：元素或盒子的陰影
* `text-shadow`：文字的陰影

陰影加得越重不一定越好，有時候只要薄薄一層，就足以讓介面產生層次。

## Lesson 11｜毛玻璃 backdrop-filter

### **想像一片真正的毛玻璃**

如果我們拿一片透明玻璃放在圖片前面，還是可以很清楚看到後面的東西。

但如果換成**毛玻璃**，你還是知道後面有東西，只是畫面會變得比較模糊。

網頁裡常見的毛玻璃效果也是類似的概念。

例如我們先有一個背景：

```css
.scene {
  background: linear-gradient(blue, pink);
}
```

### **先讓元素有一點透明**

如果我們直接放一個完全白色的區塊：

```css
.card {
  background: white;
}
```

後面的東西就全部被遮住了。

所以毛玻璃通常會先使用帶有透明度的背景：

```css
.card {
  background: #ffffff33;
}
```

讓後面的顏色可以稍微透出來。

### **再把「後面的東西」模糊掉**

接著加入：

```css
.card {
  backdrop-filter: blur(10px);
}
```

`backdrop-filter` 可以對**元素後方的內容**套用效果。

搭配透明背景後，就會產生類似：

```text
前面：半透明玻璃
後面：被模糊的背景
```

這樣的效果。

所以毛玻璃通常不是只寫一個 `blur()` 就完成，而是**透明背景與背景模糊一起搭配**，才比較能看出玻璃的感覺。

## Lesson 12｜transform 變形

### **如果今天只是想把卡片稍微移動一下**

假設畫面上有一張卡片：

```html
<div class="card">作品一</div>
```

滑鼠移上去時，我們希望它：

```text
往上移一點
放大一點
稍微轉一下
```

如果只是為了這些視覺變化而重新計算整個網頁的排版，會非常麻煩。

### **`transform` 就像直接拿起元素來移動**

CSS 提供了 `transform`。

例如：

```css
.card {
  transform: translateY(-10px);
}
```

`translate` 可以移動元素。

```css
.card {
  transform: rotate(5deg);
}
```

`rotate` 可以旋轉元素。

```css
.card {
  transform: scale(1.1);
}
```

`scale` 則可以放大或縮小元素。

可以把它想像成：原本桌面上的東西都排好了，而我們只是直接把其中一張卡片拿起來移動、旋轉或放大。

### **不同的變形還可以一起使用**

例如：

```css
.card:hover {
  transform: translateY(-5px) scale(1.05);
}
```

代表滑鼠移上去後：

**往上移一點 + 稍微放大。**

這也是為什麼 `transform` 很常拿來製作按鈕、卡片 Hover，以及後面會做到的各種動畫效果。


## Lesson 13｜Flexbox 排版

### **三張卡片到底要怎麼排？**

假設 HTML 裡有三張卡片：

```html
<div class="cards">
  <div>HTML</div>
  <div>CSS</div>
  <div>JavaScript</div>
</div>
```

我們希望它們：

```text
[ HTML ]  [ CSS ]  [ JavaScript ]
```

而且還要平均分配空間、保持距離、全部對齊。

如果每一張卡片的位置都自己慢慢算，會非常麻煩。

### **讓 Flexbox 幫我們排隊**

我們可以直接把外面的父元素設定成：

```css
.cards {
  display: flex;
}
```

這時候 `.cards` 就變成了一個 **Flex 容器**。

可以把它想像成：

**老師叫全班同學開始排隊。**

`.cards` 是負責管理隊伍的人，而裡面的三張卡片就是正在排隊的子元素。

### **告訴它們要怎麼排**

例如：

```css
.cards {
  display: flex;
  justify-content: center;
  gap: 20px;
}
```

我們可以控制這排東西要靠左、置中、平均分散，也可以調整彼此之間的距離。

另外還可以使用：

```css
align-items: center;
```

控制另一個方向的對齊方式。

所以 Flexbox 最重要的概念其實就是：

**先找到父元素，再讓父元素負責安排裡面的子元素。**

這也會再次用到前面 HTML 學過的父元素與子元素概念。

## Lesson 14｜transition 過渡動畫

### **現在元素會動了，但動得有點突然**

前面學完 `:hover` 和 `transform` 之後，我們已經可以做出：

```css
button:hover {
  transform: translateY(-5px);
}
```

滑鼠移上去後，按鈕確實會往上移。

但如果沒有其他設定，它會：

```text
原本位置 → 瞬間 → 新位置
```

中間完全沒有過程。

看起來就會像突然跳了一下。

### **`transition` 幫變化補上中間的過程**

我們可以加入：

```css
button {
  transition: 0.3s;
}
```

這時候原本的：

```text
位置 A → 位置 B
```

就會變成：

```text
位置 A → 慢慢移動 → 位置 B
```

這就是**過渡動畫（Transition）**。

### **除了多久，還可以控制怎麼變**

例如：

```css
button {
  transition: transform 0.3s ease;
}
```

這裡可以告訴 CSS：

* 哪個屬性需要動畫
* 動畫要花多久
* 中間的速度要怎麼變化

所以 `transition` 本身不是負責決定「最後要變成什麼」。

真正的兩個狀態可能是：

```css
button {
  transform: translateY(0);
}

button:hover {
  transform: translateY(-5px);
}
```

而 `transition` 做的事情，是負責把這兩個狀態中間的過程變得比較平滑。

## Lesson 15｜DOM 選取與內容操作

### **JavaScript 要怎麼知道網頁上有哪些東西？**

前面我們使用 HTML 建立了很多元素：

```html
<main>
  <h1>我的網站</h1>
  <p>歡迎回來</p>
  <button>開始</button>
</main>
```

這些元素之間本來就有父元素與子元素的關係。

當瀏覽器讀取 HTML 後，也會把這整個結構整理成一個像樹狀圖一樣的東西。

這個結構就叫做 **DOM（Document Object Model）**。

### **可以把 DOM 想成整棟房子的平面圖**

前面我們把 HTML 想像成蓋房子。

那 DOM 就很像瀏覽器把這棟房子整理成一張完整的平面圖。

JavaScript 如果今天想修改：

```html
<p id="message">歡迎回來</p>
```

第一件事情就是：

**先找到這個元素。**

例如：

```js
const message = document.querySelector('#message')
```

`querySelector()` 可以讓 JavaScript 使用類似 CSS 選擇器的方式，從 DOM 裡找到指定元素。

### **找到之後，就可以修改它**

例如：

```js
message.textContent = '登入成功！'
```

原本：

```text
歡迎回來
```

就會變成：

```text
登入成功！
```

所以 JavaScript 操作網頁時，可以先把流程想成：

```text
找到元素
↓
取得元素
↓
修改元素
```

除了文字之外，之後也可以修改 HTML 內容或元素的樣式。

## Lesson 16｜事件監聽 addEventListener

### **現在 JavaScript 會改網頁了，但什麼時候要改？**

上一課我們可以直接寫：

```js
message.textContent = '登入成功！'
```

JavaScript 執行到這一行時，文字就會立刻改變。

但真正的網站通常不是一打開頁面就自己亂改。

我們比較常需要：

```text
使用者按下按鈕 → 改變文字

使用者輸入內容 → 更新畫面

使用者做某個操作 → 執行某件事情
```

這些「發生的事情」在 JavaScript 裡就叫做**事件（Event）**。

### **替元素裝上一個感應器**

例如：

```html
<button id="change">點我</button>
```

我們可以使用：

```js
const button = document.querySelector('#change')

button.addEventListener('click', () => {
  // 點擊後要做的事情
})
```

`addEventListener()` 可以先想像成替這個按鈕裝上一個感應器。

平常什麼事都不會發生。

但一旦偵測到：

```text
click
```

也就是使用者點擊，就會執行裡面的程式。

### **事件不只有點擊**

除了：

```js
'click'
```

之外，也可以監聽：

```js
'input'
```

也就是使用者正在輸入文字。

或是：

```js
'mouseenter'
```

代表滑鼠移入某個元素。

所以事件監聽最核心的概念就是：

**「當某件事情發生時，要執行什麼程式？」**

這也是網頁開始真正產生互動的重要一步。

## Lesson 17｜動態增刪元素與 classList

### **現在我們不只可以修改房間，而是可以直接蓋新的房間**

前面 JavaScript 已經可以：

```text
找到 HTML 元素
↓
等待使用者操作
↓
修改元素內容
```

但有時候我們需要的元素，一開始根本不存在。

例如待辦清單一開始只有：

```html
<ul id="list"></ul>
```

等使用者輸入：

```text
完成 HTML 作業
```

才需要真正建立一個新的 `<li>`。

### **使用 JavaScript 建立新的 HTML 元素**

我們可以使用：

```js
const li = document.createElement('li')
```

建立一個新的 `<li>`。

再加入文字：

```js
li.textContent = '完成 HTML 作業'
```

最後：

```js
list.appendChild(li)
```

把它放進原本的 `<ul>` 裡。

可以把它想成：

```text
先蓋一個新的房間
↓
把東西放進房間
↓
再把房間接到原本的房子裡
```

這時候新的 HTML 元素就真的會出現在畫面上。

### **不要的元素也可以刪掉**

如果之後這個待辦事項完成了，也可以：

```js
li.remove()
```

直接把元素從頁面裡移除。

所以 JavaScript 不只可以修改已經存在的 HTML，也可以隨著使用者操作，**動態建立或刪除新的元素**。

### **`classList` 就像替元素切換不同的狀態**

假設我們已經準備好：

```css
.dark {
  background: black;
  color: white;
}
```

JavaScript 就可以使用：

```js
document.body.classList.toggle('dark')
```

如果原本沒有 `.dark`，就把它加上。

如果原本已經有 `.dark`，就把它拿掉。

所以 `toggle()` 很像一個開關：

```text
亮色模式 → dark 加入 → 深色模式

深色模式 → dark 移除 → 亮色模式
```

學到這裡，我們就已經把前面的內容慢慢串在一起：

```text
HTML
建立網頁結構
↓
CSS
決定網頁外觀
↓
DOM
讓 JavaScript 找到元素
↓
Event
偵測使用者操作
↓
JavaScript
動態修改、新增、刪除元素
```

到這裡，網頁就不再只是「寫好之後固定放在那裡」，而是可以真的根據使用者的操作產生變化。
