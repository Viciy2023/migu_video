# 使用方式

账号🐔了。~~只有标清..~~ 高清为主😅

gitee仓库被封...

~~gitee ip被ban，仓库链接已失效~~

仓库地址存在频道缺失或无法播放的问题，稳定性较差，回放功能仅migu源生效。

访问地址(可回看当天内容)

```shell
https://raw.githubusercontent.com/develop202/migu_video/refs/heads/main/interface.txt

https://develop202.github.io/migu_video/interface.txt
```

网络环境差的话可以用这个(不一定稳定,其他加速网站也可以)

```shell
https://gh-proxy.com/https://raw.githubusercontent.com/develop202/migu_video/refs/heads/main/interface.txt
```

# 本地部署

> [!warning]
> ⚠️注意事项
>
> 1. 登录会封号！登录会封号！登录会封号！为避免不必要的损失，请谨慎登录使用
> 1. 需要国内IP才可正常访问（非港澳台地区）

## 配置

默认本机和局域网可用，提供自定义token，格式: <http://ip:port/mpass/userid/token>（未设置mpass请删除），使用此方式建议把画质改到蓝光或更高<br>
配置信息如下:

| 环境变量名           | 默认值 | 类型    | 介绍                                                                                                                                |
| -------------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| muserId              |        | string  | 用户id<br>可在网页端登录获取                                                                                                        |
| mtoken               |        | string  | 用户token<br>可在网页端登录获取                                                                                                     |
| mport                | 1234   | number  | 本地运行端口号                                                                                                                      |
| mhost                |        | string  | 公网/自定义访问地址<br>格式<http://ip:port>                                                                                         |
| mrateType            | 3      | number  | 画质<br>2: 标清<br>3: 高清<br>4: 蓝光<br>7: 原画<br>9: 4k<br>ps:蓝光及以上需要登录且有VIP                                           |
| mpass                |        | string  | 访问密码 大小写字母和数字<br>添加后访问格式 <http://ip:port/mpass/>...                                                              |
| menableHDR           | true   | boolean | 是否开启HDR                                                                                                                         |
| menableH265          | true   | boolean | 是否开启h265(原画画质)，开启后可能存在兼容性问题，比如浏览器播放没有画面                                                            |
| mupdateInterval      | 6      | string  | 节目信息更新间隔，单位小时，不建议设置太短                                                                                          |
| mignoreCategory      | null   | string  | 屏蔽分类，每个分类名用逗号隔开<br>例如: 央视,卫视,体育-昨天,体育-明天<br>TV,体育-明天<br>ps: TV可以屏蔽所有电视，PE可以屏蔽所有体育 |
| mmergeTVCategory     | true   | boolean | 是否将TV节目数量较少的分类合并到其他分类                                                                                            |
| mcustomMergeCategory | null   | string  | 自定义合并分类到其他分类，每个分类名用逗号隔开，需先将**变量mmergeTVCategory**设置**false**<br>格式: 熊猫,综艺,新闻                 |

## node

### 环境要求

需要 NodeJS 18+ 环境

### 安装

```shell
git clone git@github.com:develop202/migu_video.git
cd migu_video
```

### 运行

```shell
node app.js
```

启动后会同时维护两套接口文件:

| 接口 | 地址 | 说明 |
| ---- | ---- | ---- |
| 咪咕动态代理 M3U | <http://ip:port/interface.txt> 或 <http://ip:port/m3u> | 由咪咕官方频道列表生成，播放时访问本服务的频道ID，再实时向咪咕获取真实播放地址并302跳转 |
| 咪咕动态代理 TXT | <http://ip:port/txt> | 与上面相同，只是 TXT 订阅格式 |
| 咪咕动态代理回看 | <http://ip:port/playback.xml> | 当前服务生成的回看节目单 |
| ZBPRO 多源 M3U | <http://ip:port/zbpro/interface.txt> 或 <http://ip:port/zbpro/m3u> | 从第三方 ZBPRO 源解密生成，效果接近 GitHub Pages 上的静态多源 M3U |
| ZBPRO 多源 TXT | <http://ip:port/zbpro/txt> | ZBPRO 的 TXT 订阅格式 |
| ZBPRO 回看 | <http://ip:port/zbpro/playback.xml> | ZBPRO 接口配套的回看节目单 |

两套接口的区别:

| 类型 | 数据来源 | URL形态 | 频道数量 | 特点 |
| ---- | ---- | ---- | ---- | ---- |
| 咪咕动态代理 | 咪咕官方 TV/体育接口 | 本服务地址 + 频道ID，例如 `/608807420` | 通常较少 | 播放时实时换取咪咕播放地址，链路清晰 |
| ZBPRO 多源 | `http://pro.fengcaizb.com/channels/pro.gz` 解密结果 | 直接直播 URL，例如 `.m3u8` | 通常较多 | 来源混合，包含咪咕、移动 IPTV、地方台、抖音等源 |

自动更新逻辑:

1. 服务启动时会立即更新一次咪咕动态代理文件和 ZBPRO 多源文件。
2. 之后按 `mupdateInterval` 定时更新，默认每 6 小时一次。
3. ZBPRO 源会生成独立文件: `zbpro-interface.txt`、`zbpro-interfaceTXT.txt`、`zbpro-playback.xml`。
4. 默认接口文件仍是 `interface.txt`、`interfaceTXT.txt`、`playback.xml`，不会被 ZBPRO 覆盖。
5. 如果设置了 `mpass`，访问 ZBPRO 接口也需要带密码，例如 <http://ip:port/mpass/zbpro/interface.txt>。

### GitHub Actions + GitHub Pages 静态部署 ZBPRO

如果只需要 ZBPRO 多源静态 M3U，可以不运行自己的 Node 服务器，直接让 GitHub Actions 定时生成文件，再用 GitHub Pages 发布。

当前仓库地址:

```text
https://github.com/Viciy2023/migu_video.git
```

工作流文件:

```text
.github/workflows/updateBydszb.yml
```

工作流会每 6 小时执行一次，也可以在 GitHub 页面手动点击 `Run workflow` 执行。它会生成并提交以下文件:

```text
zbpro-interface.txt
zbpro-interfaceTXT.txt
zbpro-playback.xml
```

开启 GitHub Pages 后，在仓库页面进入 `Settings` -> `Pages`，选择:

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

发布后可使用这些地址:

```text
https://viciy2023.github.io/migu_video/zbpro-interface.txt
https://viciy2023.github.io/migu_video/zbpro-interfaceTXT.txt
https://viciy2023.github.io/migu_video/zbpro-playback.xml
```

也可以使用 GitHub Raw 地址:

```text
https://raw.githubusercontent.com/Viciy2023/migu_video/refs/heads/main/zbpro-interface.txt
https://raw.githubusercontent.com/Viciy2023/migu_video/refs/heads/main/zbpro-interfaceTXT.txt
https://raw.githubusercontent.com/Viciy2023/migu_video/refs/heads/main/zbpro-playback.xml
```

注意: GitHub Pages 发布的是静态文件，所以没有 `/zbpro/m3u` 这种服务路由；`zbpro-interface.txt` 本身就是 M3U 文件，可以直接作为订阅地址使用。

若需要修改配置，可以使用以下命令
Mac/Linux:

```shell
mport=3000 mhost=http://localhost:3000 node app.js
```

Windows下使用git-bash等终端:

```shell
set mport=3000 && set mhost=http://localhost:3000 && node app.js
```

Windows下使用PowerShell等终端:

```shell
$Env:mport=3000; $Env:mhost="http://localhost:3000"; node app.js
```

## docker

初次使用，如有错误还请大佬指正。

### 安装

```shell
docker pull develop767/migu_video:latest
```

### 运行

```shell
docker run -p 1234:1234 --name migu_video develop767/migu_video
```

若需要修改配置，可以使用以下命令

```shell
docker run -p 3000:3000 -e mport=3000 -e mhost="http://localhost:3000" --name migu_video develop767/migu_video
```

### 构建

若需要手动构建镜像，可以使用以下命令

```shell
docker build -t migu_video .
```

# 免责声明

> [!important]
>
> 1. 本仓库仅供学习使用，请尊重版权，请勿利用此仓库从事商业行为及非法用途!
> 2. 使用本仓库的过程中可能会产生版权数据。对于这些版权数据，本仓库不拥有它们的所有权。为了避免侵权，使用者务必在 24小时内清除使用本仓库的过程中所产生的版权数据。
> 3. 由于使用本仓库产生的包括由于本协议或由于使用或无法使用本仓库而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。
> 4. **禁止在违反当地法律法规的情况下使用本仓库。** 对于使用者在明知或不知当地法律法规不允许的情况下使用本仓库所造成的任何违法违规行为由使用者承担，本仓库不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。
> 5. 如果官方平台觉得本仓库不妥，可联系本仓库更改或移除。
