function joinUrl(base, pathname) {
  return `${base.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`
}

function publicBaseUrl({ host = "", port = 1234, pass = "" } = {}) {
  const base = host || `http://localhost:${port}`
  return pass ? joinUrl(base, pass) : base.replace(/\/+$/, "")
}

function generatedFileMessages(label, containerPath, httpPath) {
  return [
    `${label}:`,
    `  容器内路径: ${containerPath}`,
    `  HTTP访问地址: ${httpPath}`,
  ]
}

function printGeneratedFile(print, label, containerPath, httpPath) {
  for (const message of generatedFileMessages(label, containerPath, httpPath)) {
    print(message)
  }
}

export { generatedFileMessages, joinUrl, printGeneratedFile, publicBaseUrl }
