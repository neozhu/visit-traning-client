const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const project = path.resolve(__dirname, '..')
const cli = process.env.WECHATIDE_CLI || 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\wechatide.cmd'
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'visitsafe-smoke-'))
let sequence = 0
const quote = value => "'" + String(value).replace(/'/g, "''") + "'"
function jsonFile(value) {
  const file = path.join(scratch, 'arg-' + (++sequence) + '.json')
  fs.writeFileSync(file, JSON.stringify(value))
  return file
}
function call(tool, flags = {}) {
  const argv = ['-c', 'Codex', tool, '--project', project]
  for (const [key, value] of Object.entries(flags)) {
    if (value !== undefined) argv.push('--' + key, String(value))
  }
  const result = spawnSync('pwsh', ['-NoProfile', '-Command', '& ' + quote(cli) + ' ' + argv.map(quote).join(' ')],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
  if (result.error) throw result.error
  const output = result.stdout || ''
  const start = output.indexOf('{')
  if (start < 0) throw new Error(tool + ': ' + output + result.stderr)
  const response = JSON.parse(output.slice(start).trim())
  if (!response.ok || response.result?.success === false) throw new Error(tool + ': ' + JSON.stringify(response))
  return response.result
}
const data = (wait = 0) => call('automation_page_action', { action: 'getData', wait }).data
const tap = selector => call('automation_element_action', { action: 'trigger', type: 'tap', selector, 'wait-for-selector': selector })
const input = (selector, value) => call('automation_element_action', { action: 'input', selector, value, 'wait-for-selector': selector })
const evaluate = (source, args) => {
  const response = call('automation_evaluate', { 'fn-source': source, 'args-file': args ? jsonFile(args) : undefined })
  return response.result.result
}
const screenshot = name => call('simulator_screenshot', { path: path.join(project, 'doc', 'verification-artifacts', name + '.jpg') })
module.exports = { call, data, tap, input, evaluate, screenshot, jsonFile, project }
