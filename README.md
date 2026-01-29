# NORTHERN EDUCATIONAL DEVELOPMENT SERVICES — Static Website (GitHub Pages)

本仓库是一个“纯静态 HTML + 生成脚本”的图库网站骨架：

- 首页自动读取 `generated/gallery.json` 展示项目列表
- 每个项目页面按 **Before / During / After** 展示图片（支持视频）
- 照片数量不限制：缩略图网格 + 懒加载 + 点击灯箱看大图

## 1) 目录结构（你主要会用到这几处）

- `projects/<slug>/project.json`：项目字段（标题、地点、年份等）
- `projects/<slug>/before|during|after/`：原始照片（放原图即可）
- `projects/<slug>/video/<phase>/`：本地视频（可选）
- `tools/build.py`：构建脚本（自动生成缩略图 + 大图 + gallery.json + 项目页）

## 2) Mac 上如何生成缩略图与索引（第一次）

```bash
cd neds-building-services-site
python3 -m pip install --upgrade pip
python3 -m pip install pillow
python3 tools/build.py
```

生成结果：

- `generated/gallery.json`
- `generated/<slug>/**`（thumb/large）

## 3) 以后你怎么加项目（最省事流程）

1. 新建项目文件夹：`projects/<slug>/`
2. 复制一个 `project.json`，改字段
3. 把照片放进：
   - `before/`
   - `during/`
   - `after/`
4. 运行：

```bash
python3 tools/build.py

在站点根目录（和 index.html 同级）运行：
python3 -m http.server 8000

然后用浏览器打开：
	http://localhost:8000/
```

5. `git add . && git commit -m "Add project" && git push`

## 4) GitHub Pages 发布（建议）

- Settings → Pages
- Build and deployment → Deploy from a branch
- Branch 选 `main` / folder 选 `/ (root)`

> 将来上域名：Settings → Pages → Custom domain，然后按 GitHub 指引设置 DNS。
> 本站使用相对路径，上域名不需要改代码。

## 5) 替换联系信息

`contact.html` 里把占位的 Email/Phone 替换成你的真实信息即可。
