import { spawn } from 'node:child_process'
import * as path from 'node:path'
import { defineExtension, useCommand } from 'reactive-vscode'
import * as vscode from 'vscode'
import { cleanupTempFile, ClipboardError, saveClipboardImage } from './clipboard'
import { commands } from './generated/meta'
import { logger } from './utils'

interface UploadResult {
  filename: string
  url: string
}

function getConfig() {
  const config = vscode.workspace.getConfiguration('pic-od')
  return {
    binaryPath: config.get<string>('binaryPath', 'pic-od'),
    profile: config.get<string>('profile', ''),
    // eslint-disable-next-line no-template-curly-in-string
    urlTemplate: config.get<string>('urlTemplate', '![${fileName}](${url})'),
  }
}

function formatUrl(template: string, result: UploadResult): string {
  return template
    .replace(/\$\{fileName\}/g, result.filename)
    .replace(/\$\{url\}/g, result.url)
}

async function uploadImages(imagePaths: string[]): Promise<UploadResult[]> {
  const { binaryPath, profile } = getConfig()

  const args = ['upload']
  if (profile) {
    args.push('--profile', profile)
  }
  args.push(...imagePaths)

  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath, args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `pic-od exited with code ${code}`))
        return
      }

      // Parse output: each line is a URL corresponding to an input image
      const urls = stdout.trim().split('\n').filter(Boolean)
      const results: UploadResult[] = imagePaths.map((imagePath, index) => ({
        filename: path.basename(imagePath),
        url: urls[index] || '',
      }))

      resolve(results)
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to execute pic-od: ${err.message}`))
    })
  })
}

async function insertTextAtCursor(text: string): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage('No active text editor')
    return
  }

  await editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, text)
  })
}

const { activate, deactivate } = defineExtension(() => {
  useCommand(commands.picOdUploadFromClipboard, async () => {
    let tempFile: string | undefined

    try {
      tempFile = await saveClipboardImage()
      await handleUpload([tempFile])
    }
    catch (err) {
      if (err instanceof ClipboardError) {
        vscode.window.showErrorMessage(err.message)
      }
      else {
        const message = err instanceof Error ? err.message : String(err)
        vscode.window.showErrorMessage(`Failed to read clipboard: ${message}`)
      }
    }
    finally {
      if (tempFile) {
        await cleanupTempFile(tempFile)
      }
    }
  })

  useCommand(commands.picOdUploadFromExplorer, async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: true,
      filters: {
        Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'],
      },
      title: 'Select images to upload',
    })

    if (!uris || uris.length === 0) {
      return
    }

    const imagePaths = uris.map(uri => uri.fsPath)
    await handleUpload(imagePaths)
  })
})

async function handleUpload(imagePaths: string[]): Promise<void> {
  const { urlTemplate } = getConfig()

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Uploading images...',
        cancellable: false,
      },
      async () => {
        const results = await uploadImages(imagePaths)
        const formattedUrls = results
          .filter(r => r.url)
          .map(r => formatUrl(urlTemplate, r))
          .join('\n')

        if (formattedUrls) {
          await insertTextAtCursor(formattedUrls)
          logger.info(`Uploaded ${results.length} image(s)`)
        }
        else {
          vscode.window.showWarningMessage('No URLs returned from upload')
        }
      },
    )
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`Upload failed: ${message}`)
    vscode.window.showErrorMessage(`Upload failed: ${message}`)
  }
}

export { activate, deactivate }
