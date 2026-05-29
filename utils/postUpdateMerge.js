import { host, pass, port } from "../config.js"
import { runCli } from "../fnos/merge-onetv-hometv.mjs"
import { joinUrl, publicBaseUrl } from "./pathLogs.js"

function shouldRunPostUpdateMerge(env = process.env) {
  return env.ONETV_MERGE_AFTER_UPDATE === "1"
}

function postUpdateMergeEnv({ host: configuredHost = host, pass: configuredPass = pass, port: configuredPort = port, cwd = process.cwd() } = {}, env = process.env) {
  const baseUrl = publicBaseUrl({ host: configuredHost, pass: configuredPass, port: configuredPort })
  return {
    ...env,
    FNOS_MIGU_URL: env.FNOS_MIGU_URL || joinUrl(baseUrl, "interface.txt"),
    REMOTE_ZBPRO_URL: env.REMOTE_ZBPRO_URL || joinUrl(baseUrl, "zbpro/interface.txt"),
    ONETV_OUTPUT: env.ONETV_OUTPUT || `${cwd}/onetv_api_hometv.m3u`,
  }
}

async function runPostUpdateMerge(env = process.env) {
  if (!shouldRunPostUpdateMerge(env)) {
    return false
  }
  await runCli(postUpdateMergeEnv({}, env))
  return true
}

export { postUpdateMergeEnv, runPostUpdateMerge, shouldRunPostUpdateMerge }
