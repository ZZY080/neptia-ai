---
name: article-to-video
description: "源文档 → 大纲 Markdown 审核 → 可选页内配图 → HTML 幻灯片 → 截图 → TTS 解说 → 字幕 → 视频。支持中文和英文视频。CLI 提供 image、screenshot、tts、srt、render。"
---

# 营销视频

基于源文档（文章、报告、PDF、网页）生成营销 / 解说视频。幻灯片使用内置模板编写为 **HTML**，截图为 PNG 后，再与 AI 解说音频和字幕合成为最终的 1920×1080 MP4 视频。

## 1. 目录结构

输入与产出写在**运行 CLI 时的当前工作目录**下的 `media/`（一般为项目根，与 `skills/` 同级），由 `paths.ts` 的 `process.cwd()` + `media` 决定。请在项目根执行 `npm run video -- …`，勿在子目录随便执行以免写到错误路径。

```
media/
├── assets/                # 共用品牌资源、logo、模板配图
├── inbound/               # 输入源文档
├── wip/<task-id>/
│   ├── source.md          # 转换为 Markdown 的源文档
│   ├── outline.md         # 视频大纲（每页幻灯片的标题、内容、解说）
│   ├── slides.html        # HTML 幻灯片页面（基于模板生成）
│   ├── images/            # 供 HTML 幻灯片内 <img> 引用的配图资源
│   │   └── *.jpg
│   ├── slides/            # 截图导出的幻灯片 PNG（每张 1920×1080）
│   │   ├── slide-001.png
│   │   ├── slide-002.png
│   │   └── ...
│   ├── segments.json      # 每页幻灯片对应的解说脚本
│   ├── audio/
│   │   └── segment-*.mp3
│   ├── subtitles/
│   │   ├── all.srt
│   │   └── segment-*.srt
│   ├── clips/
│   │   └── clip-*.mp4
│   └── concat.txt
└── outbound/<task-id>.mp4 # 最终渲染输出的视频
```

首次运行：

```bash
# 在项目根目录（npm run video 的 cwd）执行
mkdir -p media/{assets,inbound,wip,outbound}
```

## 2. 端到端工作流

### 步骤 0 - 解析源文档

**网页 URL**：使用浏览器工具打开目标 URL，等待页面渲染完成，抓取整页内容快照，并写入 `media/wip/<task-id>/source.md`。

**本地文件**（PDF、PPTX、Word 等）：

```bash
markitdown <source-file> > media/wip/<task-id>/source.md
```

完整阅读 `source.md`，提取主题、结构和关键数据点。

### 步骤 1 - 编写视频大纲（outline.md）

完整阅读 `source.md` 后，独立撰写视频大纲。大纲决定最终视频的内容脉络、幻灯片数量和节奏，**不**受任何模板示例页数限制。

#### 格式

```markdown
# <视频标题>

## Slide 1: <幻灯片标题>

- **Type**: cover | content | data | split | quote | cta
- **Content**: 幻灯片核心文案（标题、要点、指标等）
- **Background**: 期望的 CSS 背景氛围（例如："左上角带橙色光晕的暖色渐变，右下角带靛蓝点缀"）
- **Visual**（推荐）：本页「主视觉」任务——用一句话说明这一页需要哪一类画面支撑主命题（示意图、时间轴、对比图、场景图等）。尚未生成图片时写 `placeholder`，表示在 HTML 中使用模板自带的 `image-placeholder` 区块占住版面，避免整页纯文字。已有文件时写 `images/<文件名>.jpg` 等，便于在 `slides.html` 中直接引用。

### Narration

<该页幻灯片的口播解说，语气自然，能直接朗读>

## Slide 2: <幻灯片标题>

...
```

#### 规则

- **幻灯片数量由内容决定**，而不是由模板示例页数决定
- 每一页都必须包含 Type、Content、Background 和 Narration，任何字段都不能省略
- **Visual** 为推荐字段：除纯封面/极简项目外，建议每页都写，便于生成「左文右图」「封面主视觉区」等版式；与 `powerpoint-pptx` 技能中「先定分页与主命题，再为每页定义配图任务」的做法一致
- 封面页、章节分隔页、过渡页和结尾页都必须有完整条目
- 解说必须自然口语化，且可直接朗读，避免使用诸如“这一页我们看到……”或“大家好，我是……”之类的元叙述措辞
- **数据忠实度**：金额、百分比、日期和数量必须与源文档完全一致
- 最后一页的解说必须包含行动号召（CTA）
- 目标总解说时长：60 秒到 5 分钟

#### 完成标准

将完整大纲保存到 `media/wip/<task-id>/outline.md`，并先把该 Markdown 文件发给用户审核。审核材料必须是完整大纲文档，不能是摘要或节选。

只有在用户明确确认 Markdown 大纲后，才能继续执行。步骤 2 到 8 全部基于这个已批准的大纲。

### 步骤 2 - 生成 HTML 幻灯片

#### 2a. 复制模板

```bash
cp skills/video/article-to-video/template/default.html \
   media/wip/<task-id>/slides.html
```

#### 2b. 可选：生成用于页内摆放的配图

如某些幻灯片需要插图、概念图、场景图或产品示意图，可先生成 JPEG 配图，再在 HTML 中通过 `<img>` 引用。需要环境变量 **`GEMINI_API_KEY`**（Google GenAI）。生成命令：

```bash
npx tsx skills/video/article-to-video/script/cli.ts image \
  --task-id <task-id> \
  --prompt "<detailed image prompt>" \
  --filename cover-scene.jpg
```

默认输出到 `media/wip/<task-id>/images/<filename>`。如需引用共享品牌资源（例如 logo），请放在 `media/assets/`。生成后，可在 `slides.html` 中使用相对路径引用，例如：

```html
<img src="./images/cover-scene.jpg" alt="Descriptive alt text" />
```

从 `media/wip/<task-id>/slides.html` 引用共享资源时，可使用：

```html
<img
  src="../../assets/your-logo.png"
  alt="Brand logo"
/>
```

#### 2c. 编辑 slides.html

打开 `slides.html`，将示例用的 `<section class="slide ...">` 元素替换为与大纲一一对应的幻灯片 `<section>` 区块。

**HTML 生成硬性规则（必须遵守）**

- **禁止删减 `<style>`**：从模板复制后，**不得**删除、合并或「按需裁剪」`<style>` 中的任何 CSS 规则。代理或工具若只保留「当前页用到的 class」，会导致 `media-mosaic`、`image-placeholder`、`stat-grid`、`info-rail`、`tip-grid`、`cta-shell` 等版式无法使用，成片观感变「纯文字 deck」。唯一允许修改的头部区域是：按需调整 `<title>`、`<html lang>`。
- **只改 `<body>` 内的演示内容**：用大纲页替换模板中的示例 `<section>`；需要新布局时，**优先复用模板里已有结构与 class**（见下表），而不是手写极简 div。
- **落实 Visual 字段**：若大纲写了 `placeholder` 或尚未有 JPEG，使用模板中的 `image-placeholder`（可含 `placeholder-tag`、`placeholder-icon`、`placeholder-title`、`placeholder-copy`）占住一侧或一栏；若已有 `./images/...`，用 `<img>` 嵌入 `card` / `split-layout` 等容器，保持与模板示例相同的层次。
- **版式轮换**：避免连续多页仅「标题 + 多列文字卡」。封面可用 `media-mosaic` 或 `hero-grid`；过程页可用 `split-layout` 半幅配图；时间线可参考模板中 `.timeline` + 每步小图位；数据页可用 `stat-grid` / `stat-card`。

| 模板中已有、宜优先复用的布局                                          | 典型用途                 |
| --------------------------------------------------------------------- | ------------------------ |
| `media-mosaic` + `image-placeholder` / `module-card`                  | 封面主视觉 + 辅助信息格  |
| `hero-grid` + 右侧 `card-strong` 或占位                               | 标题 + 侧栏要点/数据     |
| `split-layout` + 左 `card-strong` + 右 `image-placeholder` 或 `<img>` | 左文右图                 |
| `timeline` + 每步内嵌 `image-placeholder`                             | 三阶段流程带图           |
| `info-rail` + `info-chip`                                             | 封面或过渡页的要点标签条 |
| `stat-grid` / `stat-card`                                             | 多指标并排               |
| `tip-grid` + `tip-list`                                               | 引言 + 清单式建议        |
| `cta-shell` + `cta-panel` + 侧栏占位                                  | 结尾 CTA                 |

语言要求：

- 英文视频：保持 `<html lang="en">`
- 中文视频：将 `<html>` 改为 `<html lang="zh-CN">`，或在中文页面的 `<section>` 上添加 `class="lang-zh"`
- 模板已经内置中英文字体栈；不要删除 `Noto Sans SC`、`Noto Serif SC`、`PingFang SC` 等 CJK 回退字体

每一页幻灯片都是一个如下模式的 `<section>` 元素：

```html
<section class="slide [padding] [background] [modifiers] [layout]">
  <!-- slide content -->
</section>
```

#### 幻灯片类型参考

| Type    | 推荐类名                                                                              | 说明                       |
| ------- | ------------------------------------------------------------------------------------- | -------------------------- |
| Cover   | `pad-center flex-col items-center justify-center text-center gap-32`                  | 主标题、副标题、强调线条   |
| Content | `pad-slide flex-col gap-40`                                                           | 标签 + 标题 + 项目符号列表 |
| Data    | `pad-slide flex-col gap-48`                                                           | 使用 `.card` 容器展示指标  |
| Split   | `pad-slide` + `.split-layout`（左 `card-strong` + 右 `image-placeholder` 或 `<img>`） | 双栏布局                   |
| Quote   | `pad-center flex-col items-center justify-center text-center gap-40`                  | 大号引言及署名             |
| CTA     | `pad-center flex-col items-center justify-center text-center gap-40`                  | 结尾行动号召               |

每种类型的完整可运行示例请参见模板 HTML。

#### 仅使用 CSS 背景 - 强制要求

**每一页幻灯片的背景都必须仅由 CSS 构建。** 严禁把外部图片文件、`<img>` 标签或 AI 生成图片用作幻灯片背景。页内内容区域可以使用 `<img>` 插入配图，但背景层本身必须是 CSS。可使用以下技术：

- **渐变网格**：叠加多个 `radial-gradient()` 和 `linear-gradient()`，营造有机色块
- **几何图案**：使用 `repeating-linear-gradient()` 创建网格、条纹、点阵
- **平滑过渡**：使用 `linear-gradient()`、`conic-gradient()`、`radial-gradient()`
- **装饰形状**：使用带有 `border-radius`、`clip-path`、`box-shadow` 的元素

模板 `template/default.html`（本技能目录下）内置的 **背景预设**（作为类名加在 `.slide` 上；以源文件为准，勿凭记忆杜撰类名）：

| Class           | 效果                           |
| --------------- | ------------------------------ |
| `.bg-soft`      | 浅紫靛光晕 + 轻渐变            |
| `.bg-spotlight` | 右上光斑 + 底部暖色点缀        |
| `.bg-grid`      | 纵向轻渐变，常配合 `.has-grid` |
| `.bg-panel`     | 角部径向光 + 斜向浅紫渐变      |

**修饰类**（可与任意背景预设自由组合）：

| Class         | 效果               |
| ------------- | ------------------ |
| `.has-grid`   | 叠加细微网格       |
| `.has-footer` | 底部边缘渐变强调条 |

若需深色或其它氛围，可在单页用内联 `style` 写 `background`（见下节示例），仍须遵守「背景层不用外部整页图」的规则。

如需为某一页单独定制背景，可通过内联 `style` 编写自定义 `background`：

```html
<section
  class="slide pad-slide flex-col gap-40 has-grid has-footer"
  style="background:
           radial-gradient(ellipse 700px 500px at 25% 30%, rgba(234,179,8,0.12), transparent),
           radial-gradient(ellipse 500px 400px at 75% 70%, rgba(99,102,241,0.10), transparent),
           linear-gradient(150deg, #0B1120, #111827);"
></section>
```

**视觉多样性规则**：相邻两页不能使用相同的背景处理方式。要在暖色 / 冷色网格之间交替，并变化渐变方向和光晕位置。

#### 设计原则

遵循以下审美准则（改编自 `frontend-design` skill）：

- **排版**：模板默认同时支持英文和中文。英文以 Plus Jakarta Sans / Instrument Serif 为主；中文依赖 Noto Sans SC / Noto Serif SC / PingFang SC 等回退字体。不要删掉这些字体回退，也不要改回仅支持英文的字体栈。
- **语言一致性**：单个视频应保持一种主语言；标题、正文、解说、CTA、字幕与 TTS voice 要一致。确需混排时，以主语言为准设置 `<html lang>`，并对中文页补充 `lang="zh-CN"` 或 `lang-zh`。
- **强调色**：使用 `.text-accent`、`.text-ink`、`.text-green`、`.text-gold` 等模板内工具类突出关键数字和术语（以 `default.html` 中已定义的 class 为准）。
- **数据忠实度**：金额、百分比、日期和数量必须与源文档完全一致，绝不能四舍五入、缩写或省略。
- **信息密度**：每张内容页最多 6 个项目符号。超出时应拆分为多页。
- **文本溢出**：文本绝不能溢出容器。段落请使用 `max-width`，长标题请用 `<br>` 手动换行。
- **留白**：保留充足内边距。不要让幻灯片过于拥挤，空白是刻意设计的一部分。
- **对比度**：所有文字都必须在背景上清晰可读。
- **配图使用**：如使用页内图片，务必确保其与版面协调，不遮挡核心文案，并为 `<img>` 提供合适的 `alt` 文本。

### 步骤 3 - 截图导出幻灯片

```bash
npx tsx skills/video/article-to-video/script/cli.ts screenshot --task-id <task-id>
```

通过 Playwright 驱动 Chromium 生成 `slides/slide-001.png`、`slide-002.png` 等 1920×1080 图片：优先使用本机已安装的 **Google Chrome**；若无则回退到 Playwright 自带的 Chromium（首次请在项目根执行 `npx playwright install chromium`）。验证输出数量与 `slides.html` 中 `<section class="slide">` 元素数量一致。

### 步骤 4 - 质检：对截图进行视觉检查（强制）

逐张检查 `slides/slide-001.png`、`slide-002.png` 等导出的幻灯片截图，确认以下事项：

- [ ] 文本没有溢出或被截断
- [ ] 布局没有错位，flex 容器没有损坏
- [ ] 颜色对比度良好（文字不会因背景而难以辨认）
- [ ] 字体加载正确（不是系统默认回退字体）
- [ ] 数据准确，与源文档一致
- [ ] 相邻幻灯片具有视觉变化（不存在两页完全相同的背景）
- [ ] 非极简项目时，内容页是否尽量带有主视觉区（实拍图或 `image-placeholder`），避免多页连续「仅文字卡」
- [ ] 页内配图已正确渲染，且不会压住正文内容
- [ ] 没有空白页，也没有损坏的 HTML 渲染结果
- [ ] 幻灯片页数与大纲一致

**如发现任何问题**：编辑 `slides.html`，重新执行 `screenshot`，并再次检查。在所有截图都通过视觉 QA 前，**不得**继续后续步骤。

### 步骤 5 - 编写解说与 segments.json

基于大纲中的解说内容，并结合最终 HTML 幻灯片做适配，编写 `segments.json`：

```json
{
  "segments": [
    {
      "index": 1,
      "slideIndex": 1,
      "narration": "第 1 页幻灯片的解说文本……"
    }
  ]
}
```

规则：

- **严格 1:1 映射**：segment 数量必须等于幻灯片数量。`slideIndex` 必须完整覆盖 1..N，不能有缺页或合并
- 封面页、章节分隔页和过渡页也必须有解说（可以较短）
- 解说以 `outline.md` 为基础，可以微调以适配最终 HTML 布局，但不得偏离大纲原意
- **数据忠实度**：金额、百分比、日期、数量不得改动
- 最后一个 segment 必须包含 CTA
- 总解说时长目标：60 秒到 5 分钟

### 步骤 6 - TTS（文本转语音）

中英文视频统一使用以下 TTS voice：

```bash
npx tsx skills/video/article-to-video/script/cli.ts tts \
  --task-id <task-id> \
  --voice English_Explanatory_Man \
  --tts-speed 1.0
```

使用 MiniMax T2A V2（固定模型 `speech-2.8-hd`）。无论视频是中文还是英文，默认 voice 都是 `English_Explanatory_Man`，因为该 voice 支持多语言解说。会为每个 segment 生成对应的 `audio/segment-*.mp3`，并将 `audioPath` 和 `durationSeconds` 回写到 `segments.json` 中。

环境变量：`MINIMAX_API_KEY`（必需）。

### 步骤 7 - 生成字幕

```bash
npx tsx skills/video/article-to-video/script/cli.ts srt --task-id <task-id>
```

将解说拆分为字幕行，并生成 `subtitles/all.srt` 以及按 segment 拆分的 `segment-*.srt` 文件。

### 步骤 8 - 渲染视频

```bash
npx tsx skills/video/article-to-video/script/cli.ts render --task-id <task-id>
```

将每组 `slide-*.png` + `segment-*.mp3` + `segment-*.srt` 合成为 `clip-*.mp4` 片段（1920×1080，带淡入淡出过渡），再拼接为最终的 `outbound/<task-id>.mp4`。

依赖项：`ffmpeg`、`ffprobe`。

## 3. CLI 快速参考

在项目根目录（当前工作目录 `cwd`，例如 `neptia-ai/`）下运行：

| Command                       | 用途                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `… image --task-id <id> ...`  | 按提示词生成页内 JPEG 配图                                                       |
| `… screenshot --task-id <id>` | `slides.html` → 幻灯片 PNG（Playwright）                                         |
| `… tts --task-id <id>`        | `segments.json` → 按 segment 生成 MP3（MiniMax，默认 `English_Explanatory_Man`） |
| `… srt --task-id <id>`        | `segments.json` → SRT 字幕文件                                                   |
| `… render --task-id <id>`     | 幻灯片 + 音频 + srt → 最终 MP4（ffmpeg）                                         |

其中 `…` = `npx tsx skills/video/article-to-video/script/cli.ts`（或 `npm run video --`）。

源文档解析不通过 CLI 完成，而是使用浏览器工具（针对 URL）或 `markitdown`（针对本地文件）。

## 4. 验收标准

- `slides.html` 中每个大纲页都对应一个 `.slide` 区块
- `slides.html` 中 `<style>` 与 `skills/video/article-to-video/template/default.html` **保持一致**（未做按需删减）；若确需全局样式补丁，应在保留原模板全量的基础上追加规则
- 所有幻灯片背景都仅使用 CSS，不使用外部图片
- 如使用页内配图，相关文件位于 `media/wip/<task-id>/images/` 且 `slides.html` 引用路径有效
- 截图 QA 已通过：无溢出、无布局损坏、无对比度问题
- `slides/` 中包含数量正确的 1920×1080 PNG 文件
- `segments.json` 中 segment 数量等于幻灯片数量，`slideIndex` 完整覆盖 1..N
- 每个 segment 都有有效的 `audioPath` 和 `durationSeconds`
- `outbound/<task-id>.mp4` 已生成且可播放

```bash
ffprobe -v error -show_entries format=duration,size -of default=nw=1 \
  media/outbound/<task-id>.mp4
```

## 5. 错误处理

- 关键步骤失败时，应立即报错并终止
- 绝不能覆盖 `media/inbound/` 中的产物，所有中间输出都写入 `media/wip/<task-id>/`
- 整条流程支持恢复执行：任意步骤都可以重跑，且不会丢失已有输出
- 不要越过失败的步骤继续执行，应先修复问题
