import { writeFileSync } from "node:fs"
import { appendFileSync, renameFileSync } from "./fileUtil.js"
import { dataList } from "./fetchList.js"
import { updatePlaybackData } from "./playback.js"
import updateChannels from "./zbpro.js"
import { printGreen, printMagenta, printRed } from "./colorOut.js"

async function updateZbpro(hours = 0) {
  const start = Date.now()
  const datas = await dataList()
  const channelImage = {}

  for (const data of datas) {
    for (const item of data?.dataList || []) {
      channelImage[item.name] = item.pics.highResolutionH
    }
  }

  printMagenta("开始更新ZBPRO接口文件...")
  let updateResult = 2
  for (let i = 0; i < 3; i++) {
    try {
      updateResult = await updateChannels(channelImage, "zbpro-")
      break
    } catch (error) {
      printRed("ZBPRO接口更新出现问题，正在重试...")
    }
  }

  if (updateResult === 1) {
    printGreen("ZBPRO接口数据已是最新，无需更新")
  } else if (updateResult === 2) {
    throw new Error("ZBPRO接口请求失败")
  } else {
    printGreen("ZBPRO接口文件更新完成！")
  }

  if (hours % 6 === 0) {
    try {
      const playbackFile = `${process.cwd()}/zbpro-playback.xml.bak`
      writeFileSync(playbackFile, `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<tv generator-info-name="Tak" generator-info-url="https://github.com/develop202/migu_video">\n`)
      printMagenta("开始更新ZBPRO回放文件...")
      for (const data of datas) {
        for (const item of data?.dataList || []) {
          await updatePlaybackData(item, playbackFile, 10000, 8 * 60 * 60 * 1000)
        }
      }

      appendFileSync(playbackFile, `</tv>\n`)
      renameFileSync(playbackFile, playbackFile.replace(".bak", ""))
      printGreen("ZBPRO回放文件更新完成！")
    } catch (error) {
      printRed("ZBPRO回放文件更新失败！")
    }
  }

  printGreen("成果文件已存放在以下路径:")
  printGreen(`ZBPRO M3U接口文件: ${process.cwd()}/zbpro-interface.txt`)
  printGreen(`ZBPRO TXT接口文件: ${process.cwd()}/zbpro-interfaceTXT.txt`)
  printGreen(`ZBPRO回放文件: ${process.cwd()}/zbpro-playback.xml`)
  printGreen(`ZBPRO更新用时 ${(Date.now() - start) / 1000}秒`)
}

export default updateZbpro
