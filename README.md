# 雷鸟电视精简直播源

为雷鸟（FFalcon）电视定制的精简直播列表，基于 TVBox（FongMi）客户端。

## 频道清单（32 个）

| 分组 | 频道 |
|------|------|
| 央视全套 (18) | CCTV-1 ~ CCTV-17（含 CCTV-5+） |
| 湖南广电 (13) | 湖南卫视、湖南经视、湖南都市、湖南娱乐、湖南电影、湖南电视剧、湖南爱晚、湖南教育、湖南国际、湖南公共、金鹰纪实、金鹰卡通、快乐垂钓 |
| 其他卫视 (1) | 浙江卫视 |

> 实测（2026-10-16，湖南联通）：CCTV 17/18 可播、湖南卫视/浙江卫视秒开。湖南地方台上游镜像当前从联通网络不可达，每日自动更新会在镜像恢复后自动生效。

## 部署步骤

### 第 1 步：把文件传到你的 GitHub/Gitee 仓库

1. 在 GitHub 或 Gitee 新建一个仓库（公开，比如叫 `tv-live`）
2. 把整个 `TVBox` 文件夹里的文件传上去（保留目录结构）：
   ```
   tv-live/
   ├── filter.mjs
   ├── lite.m3u
   ├── tvbox_config.json
   ├── README.md
   └── .github/
       └── workflows/
           └── update.yml
   ```
3. 上传后，浏览器打开 `lite.m3u` 的 Raw 地址，复制下来（类似 `https://raw.githubusercontent.com/你的用户名/tv-live/main/lite.m3u`）

### 第 2 步：开启 GitHub Actions（自动更新）

GitHub 仓库 → Settings → Actions → General → 勾选 "Read and write permissions"，保存。
之后每天早上 6 点（北京时间）会自动重新拉源、筛选、更新 lite.m3u。

### 第 3 步：雷鸟电视安装 TVBox

1. 雷鸟电视应用商店搜 "TVBox" 或 "FongMi"（没有就用 U 盘装 APK）
2. 打开 TVBox → 设置 → 直播源管理
3. 添加直播源，把第 1 步复制的 Raw URL 填进去
4. 默认频道设为 CCTV-1（设置 → 直播设置 → 默认频道）

## 本地测试

```bash
cd TVBox
node filter.mjs       # 重新拉源筛选，生成 lite.m3u
```
